import type { Product } from "@/lib/catalogue";
import { gstinChecksumOk } from "@/lib/gstin";
import type { GstRecord } from "@/lib/catalogue";

export type ScoreProfile = {
  segmentKey: string;
  tier: number;
  employees: number;
  sites: number;
  gstActive: boolean;
};

export function gstRecordActive(gstin: string, registry: Map<string, GstRecord>): boolean {
  const token = gstin.trim().toUpperCase();
  if (!gstinChecksumOk(token)) return false;
  return registry.get(token)?.status === "Active";
}

export function eligibilityReasons(profile: ScoreProfile, product: Product): string[] {
  const reasons: string[] = [];
  if (!product.tiers.includes(profile.tier)) {
    reasons.push(`Sold in city tier ${product.tiers.join(" and ")} only; this business is tier ${profile.tier}.`);
  }
  if (profile.employees < product.minEmployees) {
    reasons.push(`Needs at least ${product.minEmployees} employees; this business has ${profile.employees}.`);
  }
  if (profile.sites < product.minSites) {
    reasons.push(`Needs at least ${product.minSites} sites; this business has ${profile.sites}.`);
  }
  if (product.requiresGstin && !profile.gstActive) {
    reasons.push("Needs an active GSTIN on the mock registry. The supplied number is not active.");
  }
  return reasons;
}

export function eligibleIds(profile: ScoreProfile, products: Product[]): string[] {
  const passed = products.filter((product) => eligibilityReasons(profile, product).length === 0);
  const passedIds = new Set(passed.map((product) => product.id));
  return passed
    .filter((product) => product.deps.length === 0 || product.deps.some((dep) => passedIds.has(dep)))
    .map((product) => product.id);
}

export function blockedProducts(profile: ScoreProfile, products: Product[]) {
  const eligible = new Set(eligibleIds(profile, products));
  const passed = new Set(products.filter((product) => eligibilityReasons(profile, product).length === 0).map((product) => product.id));
  return products
    .filter((product) => !eligible.has(product.id))
    .map((product) => {
      const reasons = eligibilityReasons(profile, product);
      if (reasons.length === 0 && product.deps.length > 0 && !product.deps.some((dep) => passed.has(dep))) {
        reasons.push(`Every required base product is itself ineligible (${product.deps.join(", ")}).`);
      }
      return { id: product.id, name: product.name, reasons };
    });
}
