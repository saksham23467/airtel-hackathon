"""Train the catalogue ranker and write this run's evaluation.

Run from the repo root: python3 model/train.py
The historical v3 log is not an input. Numbers in artifacts/metrics.json are
from this process only.
"""

from __future__ import annotations

import json
import platform
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import KFold

sys.path.insert(0, str(Path(__file__).resolve().parent))

import recommender as reco

HISTORICAL_REFERENCE = {
    "source": "recommender_run_v3.log supplied with the prototype inputs",
    "warning": "Not a result of this script. Shown only so a later comparison can be honest.",
    "gbm_precision_at_3": 0.707427536231884,
    "gbm_precision_at_5": 0.5646739130434782,
    "pop_segment_precision_at_3": 0.683876811594203,
    "pop_segment_precision_at_5": 0.5782608695652174,
}


def classifier() -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(**reco.MODEL_PARAMS)


def ranks_for_method(method: str, eligible: list[str], scores: dict[str, float], profile, segment_counts, global_counts) -> list[str]:
    if method == "gbm":
        return sorted(eligible, key=lambda product_id: (-scores[product_id], product_id))
    if method == "pop_segment":
        counts = segment_counts[profile.segment]
        return sorted(eligible, key=lambda product_id: (-counts[product_id], -global_counts[product_id], product_id))
    if method == "pop_global":
        return sorted(eligible, key=lambda product_id: (-global_counts[product_id], product_id))
    if method == "stated_interest":
        return sorted(
            eligible,
            key=lambda product_id: (
                -int(product_id in profile.interest),
                -global_counts[product_id],
                product_id,
            ),
        )
    raise KeyError(method)


def precision_block(chosen_by_lead: dict[int, list[str]], labels: list[set[str]], k: int, eligible: list[set[str]], deps) -> dict:
    precision = []
    recall = []
    hits = []
    lengths = []
    violations = 0
    for index, chosen in chosen_by_lead.items():
        overlap = len(set(chosen) & labels[index])
        precision.append(overlap / k)
        recall.append(overlap / len(labels[index]))
        hits.append(1.0 if overlap else 0.0)
        lengths.append(len(chosen))
        if reco.bundle_violations(chosen, eligible[index], deps):
            violations += 1
    return {
        "precision": float(np.mean(precision)),
        "recall": float(np.mean(recall)),
        "hit_rate": float(np.mean(hits)),
        "violations": int(violations),
        "mean_products": float(np.mean(lengths)),
    }


def main() -> None:
    products = reco.load_catalogue()
    leads = reco.read_csv(reco.DATA / "smb_leads.csv")
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    categories = reco.categories_of(products)
    deps = reco.dependency_map(products)
    by_id = {product.product_id: product for product in products}
    product_index = {product.product_id: index for index, product in enumerate(products)}
    activated = [row for row in leads if row.get("outcome") == "Activated"]
    profiles = [reco.profile_from_lead(row, registry) for row in activated]
    labels = [reco.purchase_set(row.get("bundle_products") or "") for row in activated]
    eligible = [set(reco.eligible_ids(profile, products)) for profile in profiles]
    audit = reco.audit_historical_purchases(leads, products, registry)
    print("historical purchase audit", audit)

    methods = ["gbm", "pop_segment", "pop_global", "stated_interest"]
    assembled = {method: {3: {}, 5: {}} for method in methods}
    raw = {method: {3: {}, 5: {}} for method in methods}
    fold = KFold(n_splits=5, shuffle=True, random_state=7)
    indices = np.arange(len(activated))

    for fold_id, (train_idx, test_idx) in enumerate(fold.split(indices), start=1):
        rows_x = []
        rows_y = []
        for index in train_idx:
            profile = profiles[index]
            for product_id in sorted(eligible[index]):
                rows_x.append(reco.pair_features(profile, by_id[product_id], product_index[product_id], categories))
                rows_y.append(int(product_id in labels[index]))
        model = classifier().fit(np.array(rows_x, dtype=float), np.array(rows_y))
        segment_counts = {name: {} for name in reco.SEGMENTS}
        for name in reco.SEGMENTS:
            segment_counts[name] = {product.product_id: 0 for product in products}
        global_counts = {product.product_id: 0 for product in products}
        for index in train_idx:
            for product_id in labels[index]:
                segment_counts[profiles[index].segment][product_id] += 1
                global_counts[product_id] += 1
        for index in test_idx:
            profile = profiles[index]
            ids = sorted(eligible[index])
            if ids:
                matrix = np.array(
                    [reco.pair_features(profile, by_id[product_id], product_index[product_id], categories) for product_id in ids],
                    dtype=float,
                )
                probabilities = model.predict_proba(matrix)[:, 1]
                scores = {product_id: float(probabilities[pos]) for pos, product_id in enumerate(ids)}
            else:
                scores = {}
            for method in methods:
                ranked = ranks_for_method(method, ids, scores, profile, segment_counts, global_counts)
                for k in (3, 5):
                    assembled[method][k][int(index)] = reco.assemble(ranked, deps, k)
                    raw[method][k][int(index)] = ranked[:k]
        print(f"fold {fold_id} done", flush=True)

    metrics_methods = {}
    raw_methods = {}
    for method in methods:
        metrics_methods[method] = {
            str(k): precision_block(assembled[method][k], labels, k, eligible, deps) for k in (3, 5)
        }
        raw_methods[method] = {
            str(k): precision_block(raw[method][k], labels, k, eligible, deps) for k in (3, 5)
        }

    def p_at(store, method, k, index):
        return len(set(store[method][k][index]) & labels[index]) / k

    rng = np.random.RandomState(42)
    bootstrap = {}
    for baseline in ("pop_segment", "pop_global"):
        deltas = np.array([p_at(assembled, "gbm", 3, index) - p_at(assembled, baseline, 3, index) for index in range(len(activated))])
        samples = [rng.choice(deltas, size=len(deltas), replace=True).mean() for _ in range(2000)]
        low, high = np.percentile(samples, [2.5, 97.5])
        bootstrap[baseline] = {"delta_p3": float(deltas.mean()), "ci95": [float(low), float(high)], "resamples": 2000}

    per_segment = {}
    for name in reco.SEGMENTS:
        members = [index for index, profile in enumerate(profiles) if profile.segment == name]
        per_segment[name] = {
            method: float(np.mean([p_at(assembled, method, 3, index) for index in members])) if members else None
            for method in ("gbm", "pop_segment", "pop_global", "stated_interest")
        }

    examples = []
    for index in range(0, len(activated), max(1, len(activated) // 6)):
        row = activated[index]
        examples.append(
            {
                "lead_id": row["lead_id"],
                "segment": row["segment"],
                "actual": sorted(labels[index]),
                "gbm_assembled_3": assembled["gbm"][3][index],
                "pop_segment_assembled_3": assembled["pop_segment"][3][index],
                "gbm_assembled_5": assembled["gbm"][5][index],
            }
        )

    # Final model for serving. Evaluation above is out of fold; this fit is not.
    all_x = []
    all_y = []
    for index, profile in enumerate(profiles):
        for product_id in sorted(eligible[index]):
            all_x.append(reco.pair_features(profile, by_id[product_id], product_index[product_id], categories))
            all_y.append(int(product_id in labels[index]))
    final = classifier().fit(np.array(all_x, dtype=float), np.array(all_y))
    importance = permutation_importance(
        final,
        np.array(all_x, dtype=float),
        np.array(all_y),
        n_repeats=3,
        random_state=0,
        scoring="roc_auc",
    )
    names = reco.feature_names(categories)
    order = np.argsort(-importance.importances_mean)
    feature_rows = [
        {
            "feature": names[int(pos)],
            "permutation_roc_auc_mean": float(importance.importances_mean[int(pos)]),
            "note": "in-sample permutation on the training rows; not an out-of-fold test score",
        }
        for pos in order[:12]
    ]

    segment_counts = {name: {product.product_id: 0 for product in products} for name in reco.SEGMENTS}
    global_counts = {product.product_id: 0 for product in products}
    segment_n = {name: 0 for name in reco.SEGMENTS}
    for index, profile in enumerate(profiles):
        segment_n[profile.segment] += 1
        for product_id in labels[index]:
            segment_counts[profile.segment][product_id] += 1
            global_counts[product_id] += 1
    segment_rates = {
        name: {product_id: (segment_counts[name][product_id] / segment_n[name] if segment_n[name] else 0) for product_id in global_counts}
        for name in reco.SEGMENTS
    }
    global_rates = {product_id: global_counts[product_id] / len(activated) for product_id in global_counts}

    reco.ARTIFACTS.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": final,
            "categories": categories,
            "product_ids": [product.product_id for product in products],
            "segment_rates": segment_rates,
            "global_rates": global_rates,
            "segment_counts": segment_counts,
            "global_counts": global_counts,
            "params": reco.MODEL_PARAMS,
        },
        reco.ARTIFACTS / "ranker.joblib",
    )
    popularity = {
        "segment_counts": segment_counts,
        "global_counts": global_counts,
        "segment_n": segment_n,
        "segment_rates": segment_rates,
        "global_rates": global_rates,
        "note": "Counts are purchases by activated leads in the full synthetic quarter. The live fallback ranks with these counts. They are not the out-of-fold baseline.",
    }
    (reco.ARTIFACTS / "popularity.json").write_text(json.dumps(popularity, indent=2))
    funnel = reco.funnel_from_leads(leads)
    (reco.ARTIFACTS / "funnel.json").write_text(json.dumps(funnel, indent=2))

    import sklearn

    metrics = {
        "protocol": "5-fold lead-level CV, shuffle seed 7, on 368 activated leads. Every method uses the same eligibility filter (profile plus active mock GSTIN, and at least one eligible base) and the same dependency-complete assembler. Precision uses the original purchase labels, including purchases that were ineligible. Top-3 and top-5 bundles are assembled separately.",
        "n_activated": len(activated),
        "historical_purchase_audit": audit,
        "assembled": metrics_methods,
        "raw_topk_before_dependency_assembly": raw_methods,
        "paired_bootstrap_assembled_p3": bootstrap,
        "per_segment_assembled_p3": per_segment,
        "oof_examples": examples,
        "feature_importance_in_sample": feature_rows,
        "model_config": reco.MODEL_PARAMS,
        "versions": {
            "python": platform.python_version(),
            "sklearn": sklearn.__version__,
            "numpy": np.__version__,
        },
        "hashes": {
            "smb_leads.csv": reco.sha256_file(reco.DATA / "smb_leads.csv"),
            "product_catalogue.csv": reco.sha256_file(reco.DATA / "product_catalogue.csv"),
            "mock_gstin_registry.csv": reco.sha256_file(reco.DATA / "mock_gstin_registry.csv"),
        },
        "quoted_price_rule": "The quote uses catalogue price_min as the unit rate and one_time_setup_inr per quantity. price_max is displayed and is not charged.",
        "historical_log_reference_not_this_run": HISTORICAL_REFERENCE,
        "limitations": [
            "Trained only on synthetic activated leads, so it learns what converted customers bought, not what would have converted a dropped lead.",
            "Out-of-fold metrics are the evaluation. Scores for those same activated leads from the saved full-data model are in-sample.",
            "Quantities are not predicted. The model ranks product ids.",
            "Dependency closure can change the set relative to raw top-k. Read both tables.",
            "Top-3 and top-5 are separate bundles, not a nested prefix.",
            "Mock GSTIN status is a local file, not a government API.",
            "No calibration curve and no prospective holdout beyond this quarter.",
            "Python and scikit-learn versions are whatever this machine installed. A match to an older log is not assumed.",
        ],
    }
    (reco.ARTIFACTS / "metrics.json").write_text(json.dumps(metrics, indent=2))
    gbm3 = metrics_methods["gbm"]["3"]["precision"]
    base3 = metrics_methods["pop_segment"]["3"]["precision"]
    print(json.dumps({"gbm_p3": gbm3, "pop_segment_p3": base3, "delta": gbm3 - base3, "gbm_p5": metrics_methods["gbm"]["5"]["precision"]}, indent=2))
    print("violations gbm", metrics_methods["gbm"]["3"]["violations"], metrics_methods["gbm"]["5"]["violations"])
    print("wrote", reco.ARTIFACTS)


if __name__ == "__main__":
    main()
