import fs from "fs";
import path from "path";
import { loadCatalogue, type Product } from "@/lib/catalogue";
import { annotateBundle, assemble, bundleViolations } from "@/lib/assemble";
import { blockedProducts, eligibleIds, type ScoreProfile } from "@/lib/eligibility";
import type { BusinessProfile } from "@/lib/types";
import { gstActiveForProfile, segmentKey } from "@/lib/personas";

export type RecoItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setup: number;
  contractMonths: number;
  installDays: number;
  origin: "model" | "dependency_base";
  rank: number | null;
  satisfiedBy: string | null;
  requiresOneOf: string[];
  score: number;
  segmentRate: number;
  globalRate: number;
  inInterest: boolean;
  scoreMeaning: string;
};

export type Recommendation = {
  engine: "hist_gradient_boosting" | "segment_popularity_fallback";
  generative: false;
  distinction: string;
  gstActive: boolean;
  eligibleCount: number;
  ranked: RecoItem[];
  blocked: { id: string; name: string; reasons: string[] }[];
  bundles: Record<"3" | "5", { items: RecoItem[]; violations: string[] }>;
  inSample: boolean;
};

const SCORE_COPY =
  "This score is the model’s estimate that an activated business with this profile included the product. It is not the probability that this lead will buy.";

function asItem(raw: Record<string, unknown>, products: Map<string, Product>, origin: RecoItem["origin"]): RecoItem {
  const product = products.get(String(raw.id));
  return {
    id: String(raw.id),
    name: String(raw.name || product?.name || raw.id),
    category: String(raw.category || product?.category || ""),
    description: String(raw.description || product?.description || ""),
    unit: String(raw.unit || product?.unit || ""),
    priceMin: Number(raw.price_min ?? raw.priceMin ?? product?.priceMin ?? 0),
    priceMax: Number(raw.price_max ?? raw.priceMax ?? product?.priceMax ?? 0),
    setup: Number(raw.setup ?? product?.setup ?? 0),
    contractMonths: Number(raw.contract_months ?? raw.contractMonths ?? product?.contractMonths ?? 0),
    installDays: Number(raw.install_days ?? raw.installDays ?? product?.installDays ?? 0),
    origin,
    rank: raw.rank == null ? null : Number(raw.rank),
    satisfiedBy: (raw.satisfied_by as string) || (raw.satisfiedBy as string) || null,
    requiresOneOf: (raw.requires_one_of as string[]) || (raw.requiresOneOf as string[]) || product?.deps || [],
    score: Number(raw.score ?? 0),
    segmentRate: Number(raw.segment_rate ?? raw.segmentRate ?? 0),
    globalRate: Number(raw.global_rate ?? raw.globalRate ?? 0),
    inInterest: Boolean(raw.in_interest ?? raw.inInterest),
    scoreMeaning: SCORE_COPY,
  };
}

function normalizePython(payload: Record<string, unknown>, products: Product[]): Recommendation {
  const byId = new Map(products.map((product) => [product.id, product]));
  const mapItem = (raw: Record<string, unknown>) =>
    asItem(raw, byId, raw.origin === "dependency_base" ? "dependency_base" : "model");
  const bundles = payload.bundles as Record<string, { products?: Record<string, unknown>[]; violations?: string[] }>;
  return {
    engine: "hist_gradient_boosting",
    generative: false,
    distinction: String(payload.distinction || ""),
    gstActive: Boolean(payload.gst_active),
    eligibleCount: Number(payload.eligible_count || 0),
    ranked: ((payload.ranked as Record<string, unknown>[]) || []).map(mapItem),
    blocked: (payload.blocked as Recommendation["blocked"]) || [],
    bundles: {
      "3": { items: (bundles?.["3"]?.products || []).map(mapItem), violations: bundles?.["3"]?.violations || [] },
      "5": { items: (bundles?.["5"]?.products || []).map(mapItem), violations: bundles?.["5"]?.violations || [] },
    },
    inSample: false,
  };
}

function scoreProfile(profile: BusinessProfile): ScoreProfile {
  return {
    segmentKey: segmentKey(profile.segment),
    tier: profile.tier,
    employees: profile.employees,
    sites: profile.sites,
    gstActive: gstActiveForProfile(profile),
  };
}

export function fallbackRecommend(profile: BusinessProfile): Recommendation {
  const products = loadCatalogue();
  const scoring = scoreProfile(profile);
  const popularity = JSON.parse(fs.readFileSync(path.join(process.cwd(), "model/artifacts/popularity.json"), "utf8")) as {
    segment_counts: Record<string, Record<string, number>>;
    global_counts: Record<string, number>;
    segment_n: Record<string, number>;
  };
  const eligible = eligibleIds(scoring, products);
  const counts = popularity.segment_counts[scoring.segmentKey] || {};
  const globalCounts = popularity.global_counts || {};
  const rankedIds = [...eligible].sort(
    (a, b) => (counts[b] || 0) - (counts[a] || 0) || (globalCounts[b] || 0) - (globalCounts[a] || 0) || a.localeCompare(b),
  );
  const depsOf = Object.fromEntries(products.map((product) => [product.id, product.deps]));
  const byId = new Map(products.map((product) => [product.id, product]));
  const n = popularity.segment_n[scoring.segmentKey] || 1;
  const total = Object.values(popularity.segment_n).reduce((sum, value) => sum + value, 0) || 1;
  const decorate = (ids: string[], origins: Map<string, RecoItem["origin"]>) =>
    ids.map((id) => {
      return asItem(
        {
          id,
          score: (counts[id] || 0) / n,
          segment_rate: (counts[id] || 0) / n,
          global_rate: (globalCounts[id] || 0) / total,
          in_interest: profile.interests.includes(id),
          rank: rankedIds.indexOf(id) + 1,
        },
        byId,
        origins.get(id) || "model",
      );
    });
  const bundleFor = (k: 3 | 5) => {
    const chosen = assemble(rankedIds, depsOf, k);
    const annotated = annotateBundle(chosen, rankedIds, depsOf);
    const origins = new Map(annotated.map((item) => [item.id, item.origin]));
    const items = decorate(chosen, origins).map((item) => {
      const note = annotated.find((entry) => entry.id === item.id);
      return { ...item, origin: note?.origin || item.origin, satisfiedBy: note?.satisfiedBy || null, requiresOneOf: note?.requiresOneOf || item.requiresOneOf };
    });
    return { items, violations: bundleViolations(chosen, new Set(eligible), depsOf) };
  };
  const productOf = (id: string) => byId.get(id)!;
  return {
    engine: "segment_popularity_fallback",
    generative: false,
    distinction:
      "The model server was not reachable. This list is segment popularity among activated leads, then the same dependency assembler. It is not the gradient-boosting score.",
    gstActive: scoring.gstActive,
    eligibleCount: eligible.length,
    ranked: rankedIds.map((id, index) =>
      asItem(
        {
          id,
          name: productOf(id).name,
          score: (counts[id] || 0) / n,
          segment_rate: (counts[id] || 0) / n,
          global_rate: (globalCounts[id] || 0) / total,
          rank: index + 1,
          in_interest: profile.interests.includes(id),
        },
        byId,
        "model",
      ),
    ),
    blocked: blockedProducts(scoring, products),
    bundles: { "3": bundleFor(3), "5": bundleFor(5) },
    inSample: profile.inSample,
  };
}

export async function recommendFor(profile: BusinessProfile): Promise<Recommendation> {
  const payload = {
    segment: segmentKey(profile.segment),
    tier: profile.tier,
    employees: profile.employees,
    sites: profile.sites,
    turnover: profile.turnover,
    claims_gstin: profile.claimsGstin,
    gstin: profile.gstin,
    claims_udyam: profile.claimsUdyam,
    spend: profile.spend,
    internet: profile.internet,
    interests: profile.interests,
  };
  const url = process.env.MODEL_URL || "http://127.0.0.1:43124/recommend";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`model ${response.status}`);
    const data = (await response.json()) as Record<string, unknown>;
    const normalized = normalizePython(data, loadCatalogue());
    normalized.inSample = profile.inSample;
    return normalized;
  } catch {
    return fallbackRecommend(profile);
  }
}
