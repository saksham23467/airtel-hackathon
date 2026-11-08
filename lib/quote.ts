import type { Product } from "@/lib/catalogue";
import { addDays, CASE_TODAY } from "@/lib/gstin";
import type { Quote, QuoteLine } from "@/lib/types";
import { bundleViolations } from "@/lib/assemble";
import { eligibilityReasons, type ScoreProfile } from "@/lib/eligibility";

export const ILLUSTRATIVE_GST_RATE = 0.18;

export const PRICE_RULE =
  "Each unit is quoted at the catalogue minimum of its published monthly band. The maximum is shown and is not charged. Setup is the catalogue one-time fee times quantity.";

export const TAX_NOTE =
  "18% is an illustrative tax line for this demo, not a tax invoice and not a filed GST calculation.";

export function defaultQty(unit: string, employees: number, sites: number): number {
  if (unit === "per site") return Math.max(1, sites);
  if (unit === "per user") return Math.max(1, employees);
  if (unit === "per line") return Math.max(1, Math.min(employees, Math.max(sites, 1)));
  return 1;
}

export function taxOn(amount: number): number {
  return Math.round((amount * 18) / 100);
}

export function buildQuote(
  selections: { id: string; qty: number; origin?: QuoteLine["origin"] }[],
  products: Product[],
  profile: ScoreProfile,
): Quote {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: QuoteLine[] = [];
  const unknown: string[] = [];
  for (const selection of selections) {
    const product = byId.get(selection.id);
    if (!product) {
      unknown.push(`${selection.id} is not in the catalogue.`);
      continue;
    }
    const qty = Math.max(0, Math.floor(selection.qty));
    lines.push({
      id: product.id,
      name: product.name,
      unit: product.unit,
      qty,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      monthly: product.priceMin * qty,
      setup: product.setup * qty,
      contractMonths: product.contractMonths,
      installDays: product.installDays,
      requiresGstin: product.requiresGstin,
      deps: product.deps,
      origin: selection.origin,
    });
  }
  const monthlyPretax = lines.reduce((sum, line) => sum + line.monthly, 0);
  const setupPretax = lines.reduce((sum, line) => sum + line.setup, 0);
  const monthlyTax = taxOn(monthlyPretax);
  const setupTax = taxOn(setupPretax);
  const problems = [...unknown];
  if (!lines.length) problems.push("The quote has no lines.");
  for (const line of lines) {
    if (line.qty < 1) problems.push(`${line.id} needs a quantity of at least 1.`);
    if (line.qty > 500) problems.push(`${line.id} quantity is above the demo limit of 500.`);
  }
  const ids = lines.filter((line) => line.qty >= 1).map((line) => line.id);
  const eligible = new Set(
    products.filter((product) => eligibilityReasons(profile, product).length === 0).map((product) => product.id),
  );
  const depsOf = Object.fromEntries(products.map((product) => [product.id, product.deps]));
  for (const id of ids) {
    const product = byId.get(id);
    if (!product) continue;
    for (const reason of eligibilityReasons(profile, product)) problems.push(`${id}: ${reason}`);
  }
  for (const problem of bundleViolations(ids, eligible, depsOf)) problems.push(problem);
  const contractMonths = lines.length ? Math.max(...lines.map((line) => line.contractMonths)) : 0;
  const installDays = lines.length ? Math.max(...lines.map((line) => line.installDays)) : 0;
  return {
    lines,
    monthlyPretax,
    setupPretax,
    monthlyTax,
    setupTax,
    monthlyWithTax: monthlyPretax + monthlyTax,
    setupWithTax: setupPretax + setupTax,
    contractMonths,
    installDays,
    activationDate: installDays ? addDays(CASE_TODAY, installDays) : CASE_TODAY,
    valid: problems.length === 0,
    problems,
    priceRule: PRICE_RULE,
    taxNote: TAX_NOTE,
  };
}

export function quoteText(quote: Quote, businessName: string): string {
  const lines = [
    "ACCEL BUSINESS — UDYAM DIGITAL",
    "SIMULATED QUOTE. Not a tax invoice. No payment is collected.",
    `Business: ${businessName}`,
    `Case clock: ${CASE_TODAY}`,
    "",
    "Lines (catalogue minimum × quantity)",
  ];
  for (const line of quote.lines) {
    lines.push(
      `${line.id} ${line.name} | ${line.qty} ${line.unit} | floor ₹${line.priceMin} (band to ₹${line.priceMax}) | monthly ₹${line.monthly} | setup ₹${line.setup} | min contract ${line.contractMonths} mo | typical install ${line.installDays} d`,
    );
  }
  lines.push(
    "",
    `Monthly pre-tax ₹${quote.monthlyPretax}`,
    `Illustrative 18% on monthly ₹${quote.monthlyTax}`,
    `Setup pre-tax ₹${quote.setupPretax}`,
    `Illustrative 18% on setup ₹${quote.setupTax}`,
    `Quote term ${quote.contractMonths} months (longest catalogue minimum)`,
    `Slowest typical install ${quote.installDays} days; planning date ${quote.activationDate}`,
    quote.priceRule,
    quote.taxNote,
    quote.valid ? "Dependency and eligibility checks passed." : `Blocked: ${quote.problems.join(" ")}`,
  );
  return lines.join("\n");
}
