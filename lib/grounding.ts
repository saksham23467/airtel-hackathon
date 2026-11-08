import type { Product } from "@/lib/catalogue";
import type { BusinessProfile, Quote } from "@/lib/types";

export type ClaimContext = {
  intent: string;
  products: Product[];
  quote: Quote | null;
  spend: number;
  statedBudget: number | null;
};

export function focusProducts(products: Product[], quote: Quote | null, focusIds: string[]): Product[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const ids = quote?.lines.length ? quote.lines.map((line) => line.id) : focusIds;
  const picked = ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
  return picked.slice(0, 5);
}

export function allowedMoney(products: Product[], quote: Quote | null, profile: BusinessProfile): number[] {
  const values = new Set<number>([0, Math.round(profile.spend)]);
  for (const product of products) {
    values.add(product.priceMin);
    values.add(product.priceMax);
    values.add(product.setup);
  }
  if (quote) {
    values.add(quote.monthlyPretax);
    values.add(quote.setupPretax);
    values.add(quote.monthlyTax);
    values.add(quote.setupTax);
    values.add(quote.monthlyWithTax);
    values.add(quote.setupWithTax);
    for (const line of quote.lines) {
      values.add(line.monthly);
      values.add(line.setup);
      values.add(line.priceMin);
      values.add(line.priceMax);
    }
  }
  return [...values];
}

export function citedMoney(text: string): number[] {
  const found: number[] = [];
  const pattern = /(?:Rs\.?|INR|₹)\s*([0-9][0-9,]*)/gi;
  for (const match of text.matchAll(pattern)) {
    found.push(Number(match[1].replaceAll(",", "")));
  }
  return found;
}

export function moneyOutsideFacts(text: string, allowed: number[]): number[] {
  const ok = new Set(allowed);
  return citedMoney(text).filter((amount) => !ok.has(amount));
}

export function mentionsProduct(text: string, product: Product): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(product.id.toLowerCase())) return true;
  const name = product.name.toLowerCase();
  if (lower.includes(name)) return true;
  const head = name.split("&")[0].trim();
  return head.length >= 6 && lower.includes(head);
}

export function mentionsSuppliedProduct(text: string, products: Product[]): boolean {
  return products.some((product) => mentionsProduct(text, product));
}

export function generationUnusable(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 12) return "generation too short";
  if (!/[.।!?]"?$/.test(trimmed)) return "generation truncated";
  if (/can(?:not|'t) assist|as an ai|language model/i.test(trimmed)) return "model refusal";
  if (trimmed.includes("FACTBLOCK") || trimmed.includes("Never invent") || trimmed.includes("DRAFT:")) return "generation echoed the prompt";
  if (/DEMO_DESK_KEY|udyam-demo\b|udyam-local-advisor/i.test(trimmed)) return "generation revealed a local secret";
  return null;
}

export function hindiEnough(text: string): boolean {
  const letters = text.match(/\p{Script=Devanagari}/gu);
  return (letters?.length || 0) >= 12;
}

export function statedBudget(message: string): number | null {
  const match = message.match(/(?:budget|spend|under|below|मासिक बजट|बजट)(?:\s+[a-zA-Z\u0900-\u097F]+){0,4}\s*(?:rs\.?|inr|₹)?\s*([0-9][\d,]*)/i);
  if (!match) return null;
  const value = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return null;
  return value;
}

function paragraphs(text: string): string[] {
  return text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[।.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

function exclusionSentence(sentence: string): boolean {
  return /not recommend|do not recommend|don't recommend|i am not recommending|will not recommend|outside an internet-only|remove it|remove them|not eligible|नहीं जोड़|सुझाव नहीं|हटा|बाहर है|पात्र नहीं/i.test(sentence);
}

function paragraphMoneyProblems(paragraph: string, ctx: ClaimContext): string[] {
  const amounts = citedMoney(paragraph);
  if (!amounts.length) return [];
  const named = ctx.products.filter((product) => mentionsProduct(paragraph, product));
  const allowed = new Set<number>([0, Math.round(ctx.spend)]);
  if (ctx.statedBudget != null) allowed.add(Math.round(ctx.statedBudget));
  for (const product of named) {
    allowed.add(product.priceMin);
    allowed.add(product.priceMax);
    allowed.add(product.setup);
    const line = ctx.quote?.lines.find((item) => item.id === product.id);
    const qty = line?.qty ?? 1;
    allowed.add(product.priceMin * qty);
    allowed.add(product.setup * qty);
    if (line) {
      allowed.add(line.monthly);
      allowed.add(line.setup);
      allowed.add(line.priceMin);
      allowed.add(line.priceMax);
    }
  }
  const quoteTalk = /saved quote|quote total|illustrative|सेव कोट|कोट का योग|कर से पहले मासिक|कर से पहले सेटअप/i.test(paragraph);
  if (ctx.quote && quoteTalk) {
    allowed.add(ctx.quote.monthlyPretax);
    allowed.add(ctx.quote.setupPretax);
    allowed.add(ctx.quote.monthlyTax);
    allowed.add(ctx.quote.setupTax);
    allowed.add(ctx.quote.monthlyWithTax);
    allowed.add(ctx.quote.setupWithTax);
    for (const line of ctx.quote.lines) {
      allowed.add(line.monthly);
      allowed.add(line.setup);
    }
  }
  const problems = amounts
    .filter((amount) => !allowed.has(amount))
    .map((amount) => `rupee ${amount} is not a catalogue or quote figure for the products named beside it`);
  const setupValues = new Set<number>();
  const monthlyValues = new Set<number>();
  if (ctx.quote) {
    setupValues.add(ctx.quote.setupPretax);
    setupValues.add(ctx.quote.setupTax);
    setupValues.add(ctx.quote.setupWithTax);
    monthlyValues.add(ctx.quote.monthlyPretax);
    monthlyValues.add(ctx.quote.monthlyTax);
    monthlyValues.add(ctx.quote.monthlyWithTax);
    for (const line of ctx.quote.lines) {
      setupValues.add(line.setup);
      monthlyValues.add(line.monthly);
      monthlyValues.add(line.priceMin);
      monthlyValues.add(line.priceMax);
    }
  }
  const callsItMonthly = /per month|a month|monthly|मासिक|प्रति माह/i.test(paragraph);
  const callsItSetup = /setup|सेटअप/i.test(paragraph);
  if (callsItMonthly && !callsItSetup) {
    for (const amount of amounts) {
      if (setupValues.has(amount) && !monthlyValues.has(amount)) problems.push(`rupee ${amount} is a setup figure described as monthly`);
    }
  }
  return problems;
}

function namePositions(prior: string, product: Product): number {
  const lower = prior.toLowerCase();
  const name = product.name.toLowerCase();
  const head = name.split("&")[0].trim();
  return Math.max(lower.lastIndexOf(name), lower.lastIndexOf(product.id.toLowerCase()), head.length >= 6 ? lower.lastIndexOf(head) : -1);
}

function productOwningPhrase(sentence: string, phrase: RegExp, products: Product[]): Product | null {
  const match = phrase.exec(sentence);
  if (!match) return null;
  let owner: Product | null = null;
  let at = -1;
  for (const product of products) {
    const pos = namePositions(sentence.slice(0, match.index), product);
    if (pos > at) {
      at = pos;
      owner = product;
    }
  }
  if (owner) return owner;
  const after = sentence.slice(match.index + match[0].length).toLowerCase();
  let earliest = Number.POSITIVE_INFINITY;
  for (const product of products) {
    const name = product.name.toLowerCase();
    const head = name.split("&")[0].trim();
    const positions = [after.indexOf(name), after.indexOf(product.id.toLowerCase()), head.length >= 6 ? after.indexOf(head) : -1].filter((index) => index >= 0);
    if (!positions.length) continue;
    const pos = Math.min(...positions);
    if (pos < earliest) {
      earliest = pos;
      owner = product;
    }
  }
  return owner;
}

function unlimitedProblems(text: string, ctx: ClaimContext): string[] {
  const problems: string[] = [];
  const phrases: { pattern: RegExp; need: string; label: string }[] = [
    { pattern: /unlimited\s+data|अनलिमिटेड\s+डेटा/i, need: "unlimited data", label: "unlimited data" },
    { pattern: /unlimited\s+calls|अनलिमिटेड\s+कॉल/i, need: "unlimited calls", label: "unlimited calls" },
  ];
  for (const sentence of sentences(text)) {
    let matched = false;
    for (const phrase of phrases) {
      if (!phrase.pattern.test(sentence)) continue;
      matched = true;
      const owner = productOwningPhrase(sentence, phrase.pattern, ctx.products);
      if (!owner) problems.push(`${phrase.label} is not tied to a catalogue product`);
      else if (!owner.description.toLowerCase().includes(phrase.need)) problems.push(`${owner.id} does not say ${phrase.label}`);
    }
    if (!matched && /unlimited|अनलिमिटेड/i.test(sentence)) {
      const owner = productOwningPhrase(sentence, /unlimited|अनलिमिटेड/i, ctx.products);
      if (!owner) problems.push("unlimited is not tied to a catalogue product");
      else if (!owner.description.toLowerCase().includes("unlimited")) problems.push(`${owner.id} does not say unlimited`);
    }
  }
  return problems;
}

function dayProblems(text: string, ctx: ClaimContext): string[] {
  const problems: string[] = [];
  for (const sentence of sentences(text)) {
    const days = [...sentence.matchAll(/(\d+)\s*(?:days?|दिन)/gi)].map((match) => Number(match[1]));
    if (!days.length) continue;
    const named = ctx.products.filter((product) => mentionsProduct(sentence, product));
    for (const day of days) {
      if (day === 90 && /bill|address|kyc|केवाईसी|बिल/i.test(sentence)) continue;
      if (named.length) {
        if (!named.some((product) => product.installDays === day)) {
          problems.push(`${day} days does not match ${named.map((product) => product.id).join(", ")}`);
        }
        continue;
      }
      if (ctx.quote && /slowest|planning date|योजना तिथि|सबसे धीमी|install|इंस्टॉल/i.test(sentence)) {
        if (day !== ctx.quote.installDays) problems.push(`${day} days is not the slowest install on the quote (${ctx.quote.installDays})`);
        continue;
      }
      problems.push(`${day} days is not tied to a named catalogue product`);
    }
  }
  return problems;
}

const BUDGET_FIT = /fits (your |the |my )?budget|within (your |the |my )?budget|under budget|inside your budget|बजट में फिट|बजट के अंदर|बजट के भीतर/i;

export function claimProblems(text: string, ctx: ClaimContext): string[] {
  const problems: string[] = [];
  if (/DEMO_DESK_KEY|udyam-demo\b|udyam-local-advisor/i.test(text)) problems.push("reply includes a local secret");
  for (const paragraph of paragraphs(text)) problems.push(...paragraphMoneyProblems(paragraph, ctx));
  problems.push(...unlimitedProblems(text, ctx));
  problems.push(...dayProblems(text, ctx));
  if (BUDGET_FIT.test(text)) {
    const bench = ctx.statedBudget ?? ctx.spend;
    const monthly = ctx.quote?.monthlyPretax;
    const amounts = citedMoney(text);
    const supported = monthly != null && monthly <= bench && amounts.includes(monthly) && amounts.includes(Math.round(bench));
    if (!supported) problems.push("budget-fit wording is not supported by a saved quote at or below the typed figure");
  }
  if (ctx.intent === "internet" || ctx.intent === "discovery") {
    for (const sentence of sentences(text)) {
      for (const product of ctx.products) {
        if (product.category === "Connectivity") continue;
        if (!mentionsProduct(sentence, product)) continue;
        if (!exclusionSentence(sentence)) problems.push(`${product.id} is pushed outside an internet-only or discovery reply`);
      }
    }
  }
  return problems;
}

export function renderFactBlock(profile: BusinessProfile, quote: Quote | null, products: Product[]): string {
  const lines = [
    `Customer ${profile.businessName || "the business"} in ${profile.city}, segment ${profile.segment}, ${profile.employees} employees, ${profile.sites} sites.`,
    `Current internet: ${profile.internet}. Entered monthly telecom spend Rs ${Math.round(profile.spend)}.`,
    "Speeds in Mbps are not rupee prices. Say unlimited data only when that product's catalogue description says unlimited data.",
  ];
  if (quote) {
    lines.push(
      `Rules engine quote: Rs ${quote.monthlyPretax} per month before illustrative tax, setup Rs ${quote.setupPretax}, term ${quote.contractMonths} months, slowest typical install ${quote.installDays} days, planning date ${quote.activationDate}.`,
    );
  }
  for (const product of products) {
    const data = /unlimited data/i.test(product.description)
      ? "Catalogue says unlimited data."
      : /unlimited calls/i.test(product.description)
        ? "Catalogue says unlimited calls, not unlimited data."
        : "Catalogue states no unlimited data.";
    lines.push(
      `${product.name} (${product.id}): ${product.description}. ${data} Monthly floor Rs ${product.priceMin}, band to Rs ${product.priceMax}. Setup Rs ${product.setup}. Contract ${product.contractMonths} months. Typical install ${product.installDays} days.`,
    );
  }
  return lines.join("\n");
}
