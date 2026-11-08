"""Explainable catalogue ranker for Udyam Digital.

The gradient-boosting ranker scores eligible products. A separate assembler
builds a dependency-complete bundle of k slots. Those two steps are not the
same model. Historical v3 metrics are not imported and are not reproduced
by importing this file.
"""

from __future__ import annotations

import csv
import hashlib
import math
import statistics
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARTIFACTS = ROOT / "model" / "artifacts"
CASE_TODAY = date(2026, 7, 15)

SEGMAP = {
    "Micro retail & services": "micro",
    "Professional offices": "prof",
    "Small multi-site businesses": "multi",
    "Small manufacturers": "mfg",
}
SEGMENTS = ["micro", "prof", "multi", "mfg"]
TURN = {
    "< 40 lakh": 0,
    "40 lakh - 1.5 cr": 1,
    "1.5 - 5 cr": 2,
    "5 - 25 cr": 3,
    "25 - 100 cr": 4,
}
INETS = [
    "Business broadband",
    "Mobile hotspot",
    "Mixed per site",
    "Leased line",
    "Home broadband",
]
GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
MODEL_PARAMS = {
    "max_iter": 300,
    "learning_rate": 0.05,
    "max_leaf_nodes": 15,
    "min_samples_leaf": 20,
    "l2_regularization": 1.0,
    "random_state": 0,
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def gstin_checksum_char(gstin14: str) -> str:
    total = 0
    for i, ch in enumerate(gstin14):
        value = GST_CHARS.index(ch)
        product = value * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return GST_CHARS[(36 - (total % 36)) % 36]


def gstin_checksum_ok(gstin: str) -> bool:
    if not gstin or len(gstin) != 15:
        return False
    token = gstin.upper()
    try:
        return gstin_checksum_char(token[:14]) == token[14]
    except ValueError:
        return False


@dataclass
class Product:
    product_id: str
    category: str
    name: str
    description: str
    unit: str
    price_min: int
    price_max: int
    setup: int
    contract: int
    tiers: set[int]
    min_employees: int
    min_sites: int
    requires_gstin: bool
    deps: set[str]
    install_days: int
    segments: set[str]

    @property
    def mid_price(self) -> float:
        return (self.price_min + self.price_max) / 2


@dataclass
class Profile:
    segment: str
    tier: int
    employees: int
    sites: int
    turnover: int
    gst_flag: int
    gst_active: int
    udyam: int
    spend: float
    internet: str
    interest: set[str] = field(default_factory=set)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_catalogue(path: Path | None = None) -> list[Product]:
    rows = read_csv(path or DATA / "product_catalogue.csv")
    products: list[Product] = []
    for row in rows:
        deps = row["requires_one_of"].strip()
        products.append(
            Product(
                product_id=row["product_id"],
                category=row["category"],
                name=row["product_name"],
                description=row["description"],
                unit=row["unit"],
                price_min=int(row["price_min_inr_per_month"]),
                price_max=int(row["price_max_inr_per_month"]),
                setup=int(row["one_time_setup_inr"]),
                contract=int(row["min_contract_months"]),
                tiers={int(part) for part in row["available_city_tiers"].split(";") if part},
                min_employees=int(row["min_employees"]),
                min_sites=int(row["min_sites"]),
                requires_gstin=row["requires_gstin"] == "Y",
                deps=set(deps.split("|")) if deps else set(),
                install_days=int(row["typical_install_days"]),
                segments=set(row["target_segments"].split(";")) if row["target_segments"] else set(),
            )
        )
    return products


def load_registry(path: Path) -> dict[str, dict[str, str]]:
    key = "gstin" if "gstin" in path.name else "udyam_number"
    return {row[key]: row for row in read_csv(path)}


def gst_is_active(gstin: str, registry: dict[str, dict[str, str]]) -> bool:
    token = (gstin or "").strip().upper()
    if not gstin_checksum_ok(token):
        return False
    row = registry.get(token)
    return bool(row and row.get("status") == "Active")


def eligibility_reasons(profile: Profile, product: Product) -> list[str]:
    reasons: list[str] = []
    if profile.tier not in product.tiers:
        tiers = ", ".join(str(tier) for tier in sorted(product.tiers))
        reasons.append(f"Sold in city tier {tiers} only; this business is tier {profile.tier}.")
    if profile.employees < product.min_employees:
        reasons.append(
            f"Needs at least {product.min_employees} employees; this business has {profile.employees}."
        )
    if profile.sites < product.min_sites:
        reasons.append(f"Needs at least {product.min_sites} sites; this business has {profile.sites}.")
    if product.requires_gstin and not profile.gst_active:
        reasons.append("Needs an active GSTIN on the mock registry. The supplied number is not active.")
    return reasons


def eligible_ids(profile: Profile, products: list[Product]) -> list[str]:
    by_id = {product.product_id: product for product in products}
    passed = [product.product_id for product in products if not eligibility_reasons(profile, product)]
    passed_set = set(passed)
    kept: list[str] = []
    for product_id in passed:
        deps = by_id[product_id].deps
        if deps and not (deps & passed_set):
            continue
        kept.append(product_id)
    return kept


def blocked_products(profile: Profile, products: list[Product]) -> list[dict]:
    eligible = set(eligible_ids(profile, products))
    by_id = {product.product_id: product for product in products}
    passed = {product.product_id for product in products if not eligibility_reasons(profile, product)}
    blocked = []
    for product in products:
        if product.product_id in eligible:
            continue
        reasons = eligibility_reasons(profile, product)
        if not reasons and product.deps and not (product.deps & passed):
            bases = ", ".join(sorted(product.deps))
            reasons.append(f"Every required base product is itself ineligible ({bases}).")
        blocked.append(
            {
                "id": product.product_id,
                "name": product.name,
                "reasons": reasons,
            }
        )
    return blocked


def assemble(ranked: list[str], deps_of: dict[str, set[str]], k: int) -> list[str]:
    """Fill k slots in rank order, pulling required bases in before a dependent.

    Top-k values are assembled separately by the caller. A k=3 result is not a
    prefix of the k=5 result.
    """
    rank = {product_id: index for index, product_id in enumerate(ranked)}
    chosen: list[str] = []
    used: set[str] = set()

    def best_base(deps: set[str], have: set[str]) -> str | None:
        present = [dep for dep in deps if dep in have and dep in rank]
        if present:
            return min(present, key=lambda dep: (rank[dep], dep))
        candidates = [dep for dep in deps if dep in rank]
        if not candidates:
            return None
        return min(candidates, key=lambda dep: (rank[dep], dep))

    def chain(product_id: str, acc: list[str], stack: set[str]) -> list[str] | None:
        have = used | set(acc)
        if product_id in have:
            return []
        if product_id in stack or product_id not in rank:
            return None
        out: list[str] = []
        deps = deps_of.get(product_id) or set()
        if deps and not (deps & have):
            base = best_base(deps, have)
            if base is None:
                return None
            nested = chain(base, acc + out, stack | {product_id})
            if nested is None:
                return None
            out.extend(nested)
        out.append(product_id)
        return out

    for product_id in ranked:
        if len(chosen) >= k:
            break
        if product_id in used:
            continue
        extra = chain(product_id, [], set())
        if extra is None or len(chosen) + len(extra) > k:
            continue
        for item in extra:
            if item not in used:
                chosen.append(item)
                used.add(item)
    return chosen


def bundle_violations(chosen: list[str], eligible: set[str], deps_of: dict[str, set[str]]) -> list[str]:
    problems = []
    chosen_set = set(chosen)
    for product_id in chosen:
        if product_id not in eligible:
            problems.append(f"{product_id} is not eligible")
        deps = deps_of.get(product_id) or set()
        if deps and not (deps & chosen_set):
            problems.append(f"{product_id} is missing a required base")
    return problems


def annotate_bundle(chosen: list[str], ranked: list[str], deps_of: dict[str, set[str]]) -> dict:
    rank = {product_id: index for index, product_id in enumerate(ranked)}
    origins: dict[str, str] = {}
    used: set[str] = set()
    # Replay the greedy choices so dependency inserts stay distinguishable from rank picks.
    rebuilt = assemble(ranked, deps_of, len(chosen) if chosen else 0)
    # Origin is recovered by a second pass over rank order with the same budget.
    k = len(chosen)
    chosen_set = set(chosen)
    for product_id in ranked:
        if len(used) >= k:
            break
        if product_id in used or product_id not in chosen_set:
            continue
        deps = deps_of.get(product_id) or set()
        if deps and not (deps & used):
            bases = [dep for dep in chosen if dep in deps and dep not in used]
            for base in bases:
                origins.setdefault(base, "dependency_base")
                used.add(base)
        origins.setdefault(product_id, "model")
        used.add(product_id)
    items = []
    for product_id in chosen:
        deps = deps_of.get(product_id) or set()
        hits = [dep for dep in chosen if dep in deps]
        satisfied = min(hits, key=lambda dep: (rank.get(dep, 10_000), dep)) if hits else None
        items.append(
            {
                "id": product_id,
                "origin": origins.get(product_id, "model"),
                "rank": (rank[product_id] + 1) if product_id in rank else None,
                "satisfied_by": satisfied,
                "requires_one_of": sorted(deps),
            }
        )
    return {"products": items, "ids": chosen, "mean_note": "assembled separately for this slot budget"}


def feature_names(categories: list[str]) -> list[str]:
    return (
        [
            "tier",
            "log_emp",
            "sites",
            "turnover",
            "gstin",
            "udyam",
            "log_spend",
            "in_interest",
            "seg_target_match",
            "log_price",
            "setup_k",
            "install_days",
            "contract",
            "has_dependency",
            "min_emp",
            "min_sites",
            "req_gstin",
            "product_idx",
        ]
        + [f"seg_{name}" for name in SEGMENTS]
        + [f"cat_{name}" for name in categories]
        + [f"inet_{name}" for name in INETS]
        + ["price_vs_spend"]
    )


def pair_features(profile: Profile, product: Product, product_index: int, categories: list[str]) -> list[float]:
    values = [
        float(profile.tier),
        math.log1p(profile.employees),
        float(profile.sites),
        float(profile.turnover),
        float(profile.gst_flag),
        float(profile.udyam),
        math.log1p(max(profile.spend, 0)),
        float(product.product_id in profile.interest),
        float(profile.segment in product.segments),
        math.log1p(product.mid_price),
        product.setup / 1000,
        float(product.install_days),
        float(product.contract),
        float(bool(product.deps)),
        float(product.min_employees),
        float(product.min_sites),
        float(product.requires_gstin),
        float(product_index),
    ]
    values += [float(profile.segment == name) for name in SEGMENTS]
    values += [float(product.category == name) for name in categories]
    values += [float(profile.internet == name) for name in INETS]
    values.append(math.log1p(product.mid_price) - math.log1p(max(profile.spend, 0)))
    return values


def profile_from_lead(row: dict[str, str], registry: dict[str, dict[str, str]]) -> Profile:
    interest = set()
    raw_interest = (row.get("products_of_interest") or "").strip()
    if raw_interest:
        interest = {part for part in raw_interest.split(";") if part}
    gstin = (row.get("gstin") or "").strip().upper()
    return Profile(
        segment=SEGMAP[row["segment"]],
        tier=int(row["city_tier"]),
        employees=int(row["employee_count"]),
        sites=int(row["num_sites"]),
        turnover=TURN.get(row["annual_turnover_band"], 1),
        gst_flag=int(row.get("has_gstin") == "Y"),
        gst_active=int(gst_is_active(gstin, registry)),
        udyam=int(row.get("has_udyam") == "Y"),
        spend=float(row.get("monthly_telecom_spend_inr") or 0),
        internet=row.get("current_internet") or "",
        interest=interest,
    )


def profile_from_request(payload: dict, registry: dict[str, dict[str, str]]) -> Profile:
    segment = payload.get("segment") or "micro"
    if segment in SEGMAP:
        segment = SEGMAP[segment]
    turnover = payload.get("turnover", 1)
    if isinstance(turnover, str):
        turnover = TURN.get(turnover, 1)
    gstin = str(payload.get("gstin") or "").strip().upper()
    claims_gstin = bool(payload.get("claims_gstin")) or bool(gstin)
    interests = payload.get("interests") or []
    return Profile(
        segment=segment,
        tier=int(payload.get("tier") or 1),
        employees=int(payload.get("employees") or 1),
        sites=int(payload.get("sites") or 1),
        turnover=int(turnover),
        gst_flag=int(claims_gstin),
        gst_active=int(gst_is_active(gstin, registry)),
        udyam=int(bool(payload.get("claims_udyam"))),
        spend=float(payload.get("spend") or 0),
        internet=str(payload.get("internet") or ""),
        interest={str(item) for item in interests if item},
    )


def purchase_set(bundle: str) -> set[str]:
    found = set()
    for part in (bundle or "").split(";"):
        if part:
            found.add(part.split("x")[0])
    return found


def audit_historical_purchases(
    leads: list[dict[str, str]],
    products: list[Product],
    registry: dict[str, dict[str, str]],
) -> dict[str, int]:
    """Count infeasible historical purchase lines.

    Profile failures use city tier, employees, sites, and the lead's has_gstin
    flag. Same-bundle dependency failures are lines that passed that profile
    check but did not contain a required base. Inactive-registry failures are
    an additional count: GST-required lines that passed both of those checks
    while the GSTIN is missing, checksum-invalid, or not Active.
    """
    by_id = {product.product_id: product for product in products}
    lines = profile = dependency_only = union = inactive = 0
    for row in leads:
        if row.get("outcome") != "Activated":
            continue
        bought = purchase_set(row.get("bundle_products") or "")
        gstin = (row.get("gstin") or "").strip().upper()
        active = gst_is_active(gstin, registry)
        flag = row.get("has_gstin") == "Y"
        for product_id in bought:
            product = by_id[product_id]
            lines += 1
            failed_profile = False
            if int(row["city_tier"]) not in product.tiers:
                failed_profile = True
            if int(row["employee_count"]) < product.min_employees:
                failed_profile = True
            if int(row["num_sites"]) < product.min_sites:
                failed_profile = True
            if product.requires_gstin and not flag:
                failed_profile = True
            missing_base = bool(product.deps) and not (product.deps & bought)
            if failed_profile:
                profile += 1
            if missing_base and not failed_profile:
                dependency_only += 1
            if failed_profile or missing_base:
                union += 1
            if (not failed_profile) and (not missing_base) and product.requires_gstin and not active:
                inactive += 1
    return {
        "lines": lines,
        "profile": profile,
        "dependency_only": dependency_only,
        "union_profile_or_dependency": union,
        "additional_inactive_registry": inactive,
    }


def dependency_map(products: list[Product]) -> dict[str, set[str]]:
    return {product.product_id: set(product.deps) for product in products}


def categories_of(products: list[Product]) -> list[str]:
    return sorted({product.category for product in products})


def score_eligible(
    model,
    profile: Profile,
    products: list[Product],
    categories: list[str],
) -> list[tuple[str, float]]:
    by_id = {product.product_id: product for product in products}
    index = {product.product_id: i for i, product in enumerate(products)}
    ids = eligible_ids(profile, products)
    if not ids:
        return []
    matrix = np.array(
        [pair_features(profile, by_id[product_id], index[product_id], categories) for product_id in ids],
        dtype=float,
    )
    probabilities = model.predict_proba(matrix)[:, 1]
    order = np.argsort(-probabilities)
    return [(ids[int(i)], float(probabilities[int(i)])) for i in order]


def public_product(product: Product) -> dict:
    return {
        "id": product.product_id,
        "name": product.name,
        "category": product.category,
        "description": product.description,
        "unit": product.unit,
        "price_min": product.price_min,
        "price_max": product.price_max,
        "setup": product.setup,
        "contract_months": product.contract,
        "install_days": product.install_days,
        "requires_gstin": product.requires_gstin,
        "requires_one_of": sorted(product.deps),
        "min_employees": product.min_employees,
        "min_sites": product.min_sites,
        "city_tiers": sorted(product.tiers),
        "target_segments": sorted(product.segments),
    }


def recommend_with_model(model, profile: Profile, products: list[Product], categories: list[str], segment_rates: dict, global_rates: dict) -> dict:
    by_id = {product.product_id: product for product in products}
    scored = score_eligible(model, profile, products, categories)
    ranked_ids = [product_id for product_id, _score in scored]
    scores = {product_id: score for product_id, score in scored}
    deps = dependency_map(products)
    eligible = set(ranked_ids)
    bundles = {}
    for k in (3, 5):
        chosen = assemble(ranked_ids, deps, k)
        problems = bundle_violations(chosen, eligible, deps)
        annotated = annotate_bundle(chosen, ranked_ids, deps)
        for item in annotated["products"]:
            product = by_id[item["id"]]
            item.update(public_product(product))
            item["score"] = round(scores.get(item["id"], 0.0), 4)
            item["segment_rate"] = segment_rates.get(profile.segment, {}).get(item["id"], 0)
            item["global_rate"] = global_rates.get(item["id"], 0)
            item["in_interest"] = item["id"] in profile.interest
        bundles[str(k)] = {**annotated, "violations": problems}
    ranked_public = []
    for position, (product_id, score) in enumerate(scored, start=1):
        product = by_id[product_id]
        ranked_public.append(
            {
                **public_product(product),
                "score": round(score, 4),
                "rank": position,
                "segment_rate": segment_rates.get(profile.segment, {}).get(product_id, 0),
                "global_rate": global_rates.get(product_id, 0),
                "in_interest": product_id in profile.interest,
            }
        )
    return {
        "engine": "hist_gradient_boosting",
        "eligible_count": len(ranked_ids),
        "ranked": ranked_public,
        "blocked": blocked_products(profile, products),
        "bundles": bundles,
        "gst_active": bool(profile.gst_active),
        "distinction": "Model scores rank eligible products. Dependency closure is a separate assembler and can insert a base the model did not pick first.",
    }


STAGE_ORDER = [
    "Lead",
    "Contacted",
    "Needs assessed",
    "Quote accepted",
    "KYC complete",
    "Activated",
]


def funnel_from_leads(leads: list[dict[str, str]]) -> dict:
    """Cumulative funnel. stage_reached is the last stage, so earlier stages count too."""

    def at_least(stage: str) -> int:
        threshold = STAGE_ORDER.index(stage)
        return sum(1 for row in leads if STAGE_ORDER.index(row["stage_reached"]) >= threshold)

    activated = [row for row in leads if row.get("outcome") == "Activated"]
    days = [float(row["days_lead_to_activation"]) for row in activated if row.get("days_lead_to_activation")]
    calls = [float(row["customer_follow_up_calls"] or 0) for row in activated]
    values = [float(row["monthly_bundle_value_inr"]) for row in activated if row.get("monthly_bundle_value_inr")]
    activated_costs = [float(row["acquisition_cost_inr"] or 0) for row in activated]
    total_cost = sum(float(row["acquisition_cost_inr"] or 0) for row in leads)
    churn = sum(1 for row in activated if row.get("churned_within_6_months") == "Y")
    with_gst = [row for row in leads if row.get("has_gstin") == "Y"]
    without_gst = [row for row in leads if row.get("has_gstin") != "Y"]

    def activation_rate(rows: list[dict[str, str]]) -> float:
        if not rows:
            return 0.0
        return sum(1 for row in rows if row.get("outcome") == "Activated") / len(rows)

    segments = []
    for label, key in SEGMAP.items():
        rows = [row for row in leads if row.get("segment") == label]
        act = [row for row in rows if row.get("outcome") == "Activated"]
        mean_mrr = (
            sum(float(row["monthly_bundle_value_inr"]) for row in act if row.get("monthly_bundle_value_inr")) / len(act)
            if act
            else 0
        )
        cac = sum(float(row["acquisition_cost_inr"] or 0) for row in act) / len(act) if act else 0
        segments.append(
            {
                "segment": label,
                "key": key,
                "leads": len(rows),
                "activated": len(act),
                "activation_rate": len(act) / len(rows) if rows else 0,
                "mean_monthly_bundle_inr": mean_mrr,
                "mean_acquisition_cost_inr": cac,
                "revenue_months_to_cover_cac": (cac / mean_mrr) if mean_mrr else None,
                "note": "revenue months are acquisition cost divided by mean monthly bundle, not profit payback",
            }
        )
    sources = []
    source_names = sorted({row["lead_source"] for row in leads})
    for name in source_names:
        rows = [row for row in leads if row["lead_source"] == name]
        act = [row for row in rows if row.get("outcome") == "Activated"]
        sources.append(
            {
                "source": name,
                "leads": len(rows),
                "activated": len(act),
                "activation_rate": len(act) / len(rows) if rows else 0,
                "acquisition_cost_inr": sum(float(row["acquisition_cost_inr"] or 0) for row in rows),
            }
        )
    drops: dict[str, int] = {}
    for row in leads:
        reason = (row.get("drop_reason") or "").strip()
        if reason:
            drops[reason] = drops.get(reason, 0) + 1
    median = statistics.median(values) if values else 0
    stages = []
    previous = None
    for stage in STAGE_ORDER:
        count = at_least(stage)
        stages.append(
            {
                "stage": stage,
                "leads": count,
                "share_of_previous": (count / previous) if previous else None,
            }
        )
        previous = count
    return {
        "leads": len(leads),
        "activated": len(activated),
        "stages": stages,
        "mean_days_lead_to_activation": sum(days) / len(days) if days else None,
        "mean_follow_up_calls": sum(calls) / len(calls) if calls else None,
        "median_monthly_bundle_inr": median,
        "mean_monthly_bundle_inr": sum(values) / len(values) if values else None,
        "total_acquisition_cost_inr": total_cost,
        "blended_acquisition_cost_per_activation_inr": total_cost / len(activated) if activated else None,
        "mean_recorded_cost_on_activated_inr": sum(activated_costs) / len(activated) if activated else None,
        "churned_within_6_months": churn,
        "churn_rate": churn / len(activated) if activated else None,
        "activation_with_gstin_flag": {
            "activated": sum(1 for row in with_gst if row.get("outcome") == "Activated"),
            "leads": len(with_gst),
            "rate": activation_rate(with_gst),
        },
        "activation_without_gstin_flag": {
            "activated": sum(1 for row in without_gst if row.get("outcome") == "Activated"),
            "leads": len(without_gst),
            "rate": activation_rate(without_gst),
        },
        "segments": segments,
        "sources": sources,
        "drop_reasons": [{"reason": key, "leads": drops[key]} for key in sorted(drops, key=lambda item: -drops[item])],
        "case_clock": CASE_TODAY.isoformat(),
    }
