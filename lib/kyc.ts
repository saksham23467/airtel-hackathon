import type { GstRecord, UdyamRecord } from "@/lib/catalogue";
import {
  ageInDays,
  chooseGstinReading,
  gstinTokenFromOcr,
  maskGstin,
  maskUdyam,
  udyamFromOcr,
} from "@/lib/gstin";
import type { DocKind, KycCheck, KycEvaluation } from "@/lib/types";

const GENERIC = new Set([
  "pvt",
  "ltd",
  "llp",
  "private",
  "limited",
  "company",
  "prop",
  "proprietor",
  "clinic",
  "care",
  "shop",
  "services",
  "associates",
  "enterprise",
  "store",
  "centre",
  "center",
  "and",
  "the",
]);

function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function between(text: string, start: RegExp, end: RegExp): string {
  const flat = flatten(text);
  const startMatch = start.exec(flat);
  if (!startMatch) return "";
  const from = flat.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(from);
  return (endMatch ? from.slice(0, endMatch.index) : from).trim();
}

function distinctive(value: string): string[] {
  const prop = value.match(/prop\.?\s*([^)]+)\)/i);
  const core = prop ? prop[1] : value;
  return core
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !GENERIC.has(word));
}

export function businessNamesAlign(left: string, right: string): boolean {
  const a = distinctive(left);
  const b = distinctive(right);
  if (!a.length || !b.length) return false;
  const bSet = new Set(b);
  const aSet = new Set(a);
  const shared = a.filter((word) => bSet.has(word)).length;
  const subset = (a.every((word) => bSet.has(word)) || b.every((word) => aSet.has(word))) && Math.min(a.length, b.length) >= 2;
  return subset || shared / Math.max(a.length, b.length) >= 0.8;
}

export function needsAuthorisation(constitution: string): boolean {
  return /llp|private limited|limited liability/i.test(constitution);
}

function check(layer: KycCheck["layer"], label: string, status: KycCheck["status"], detail: string): KycCheck {
  return { layer, label, status, detail };
}

function outcomeFrom(checks: KycCheck[]): KycEvaluation["outcome"] {
  if (checks.some((item) => item.status === "fail")) return "failed";
  if (checks.some((item) => item.status === "review")) return "manual_review";
  return "passed";
}

export function evaluateDocument(
  kind: DocKind,
  ocrText: string,
  context: {
    businessName: string;
    gst: Map<string, GstRecord>;
    udyam: Map<string, UdyamRecord>;
  },
): KycEvaluation {
  const fields: Record<string, string> = {};
  const checks: KycCheck[] = [];
  const text = ocrText || "";

  if (kind === "gst") {
    const token = gstinTokenFromOcr(text);
    fields.gstinRaw = token ?? "";
    if (!token) {
      checks.push(check("ocr", "GSTIN token", "review", "No GSTIN token was found beside a GSTIN label. The scan is queued for a person."));
      checks.push(check("checksum", "GSTIN checksum", "skipped", "Checksum waits for a token."));
      checks.push(check("mock_registry", "Mock GST registry", "skipped", "Registry lookup waits for a checksum-valid reading."));
    } else {
      checks.push(check("ocr", "GSTIN token", "pass", `Raw OCR token ${token}.`));
      const reading = chooseGstinReading(token, (gstin) => context.gst.has(gstin));
      if (!reading.value) {
        checks.push(check("checksum", "GSTIN checksum", "fail", reading.note));
        checks.push(check("mock_registry", "Mock GST registry", "skipped", "Lookup waits for a checksum-valid reading. A similar trade name is not substituted."));
      } else {
        fields.gstin = reading.value;
        checks.push(check("checksum", "GSTIN checksum", "pass", reading.note));
        const record = context.gst.get(reading.value);
        if (!record) {
          checks.push(check("mock_registry", "Mock GST registry", "fail", `${maskGstin(reading.value)} is checksum-valid and absent from the mock registry.`));
        } else if (record.status !== "Active") {
          checks.push(check("mock_registry", "Mock GST registry", "fail", `Mock registry status for ${maskGstin(reading.value)} is ${record.status}.`));
          fields.trade = record.trade_name;
          fields.legalRegistry = record.legal_name;
          fields.status = record.status;
        } else {
          checks.push(check("mock_registry", "Mock GST registry", "pass", `Mock registry status for ${maskGstin(reading.value)} is Active. This is a local file, not a government API.`));
          fields.trade = record.trade_name;
          fields.legalRegistry = record.legal_name;
          fields.status = record.status;
        }
      }
    }
    const legal = between(text, /Legal name/i, /Trade[- ]name/i);
    const trade = between(text, /Trade[- ]name/i, /Constitution/i);
    const constitution = between(text, /Constitution/i, /Address of principal/i);
    if (legal) fields.legal = legal;
    if (trade) fields.tradeOcr = trade;
    if (constitution) fields.constitution = constitution;
    if (fields.trade && trade) {
      const aligned = businessNamesAlign(trade, fields.trade);
      checks.push(
        check(
          "rule",
          "Trade name",
          aligned ? "pass" : "review",
          aligned
            ? "OCR trade name aligns with the mock registry trade name."
            : `OCR trade name “${trade}” does not align with the mock registry trade name. Left for a person.`,
        ),
      );
    }
    if (fields.legalRegistry && legal) {
      const aligned = businessNamesAlign(legal, fields.legalRegistry);
      checks.push(
        check(
          "rule",
          "Legal name",
          aligned ? "pass" : "review",
          aligned
            ? "OCR legal name aligns with the mock registry legal name."
            : `OCR legal name “${legal}” does not align with the mock registry legal name. Left for a person.`,
        ),
      );
    }
    if (needsAuthorisation(constitution)) {
      checks.push(check("rule", "Authorisation", "info", "LLP or company constitution: checkout also needs the signatory attestation. That attestation is not an MCA check."));
    }
  }

  if (kind === "udyam") {
    const parsed = udyamFromOcr(text);
    if (!parsed.value && parsed.readableCertificate) {
      checks.push(check("ocr", "Udyam number", "fail", "The certificate is readable and the Udyam number is blank."));
      checks.push(check("checksum", "Udyam format", "skipped", "There is no number to format-check."));
      checks.push(check("mock_registry", "Mock Udyam registry", "skipped", "Lookup waits for a number."));
    } else if (!parsed.value) {
      checks.push(check("ocr", "Udyam number", "review", "No Udyam number could be read. The scan is queued for a person."));
      checks.push(check("checksum", "Udyam format", "skipped", "Format check waits for a number."));
      checks.push(check("mock_registry", "Mock Udyam registry", "skipped", "Lookup waits for a number."));
    } else {
      fields.udyam = parsed.value;
      checks.push(check("ocr", "Udyam number", "pass", `Read ${maskUdyam(parsed.value)}.`));
      checks.push(check("checksum", "Udyam format", "pass", "Format matches UDYAM-SS-DD-NNNNNNN. District 00 is the synthetic marker in this pack and is accepted."));
      const record = context.udyam.get(parsed.value);
      if (!record) {
        checks.push(check("mock_registry", "Mock Udyam registry", "fail", `${maskUdyam(parsed.value)} is not in the mock Udyam registry.`));
      } else {
        fields.enterpriseRegistry = record.enterprise_name;
        checks.push(check("mock_registry", "Mock Udyam registry", "pass", `Mock registry lists ${record.enterprise_name}. This is a local file.`));
        const enterprise = between(text, /Enterprise name/i, /Major activity/i);
        if (enterprise) {
          fields.enterprise = enterprise;
          const aligned = businessNamesAlign(enterprise, record.enterprise_name);
          checks.push(check("rule", "Enterprise name", aligned ? "pass" : "review", aligned ? "OCR enterprise name aligns with the mock registry." : "OCR enterprise name does not align with the mock registry."));
        }
      }
    }
  }

  if (kind === "address") {
    const flat = flatten(text);
    const date = flat.match(/Bill date\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "";
    const billed = between(text, /Billed to/i, /Supply address/i);
    if (!/bill date|billed to|electricity/i.test(text)) {
      checks.push(check("ocr", "Address proof", "review", "The image does not look like a readable utility bill. Queued for a person."));
      checks.push(check("rule", "Bill age", "skipped", "The 90-day rule waits for a bill date."));
    } else if (!date) {
      checks.push(check("ocr", "Bill date", "review", "A bill was detected but the date was not read. Queued for a person."));
      checks.push(check("rule", "Bill age", "skipped", "The 90-day rule waits for a date."));
    } else {
      fields.billDate = date;
      checks.push(check("ocr", "Bill date", "pass", `Read ${date}.`));
      const age = ageInDays(date);
      if (age === null) checks.push(check("rule", "Bill age", "review", "The date could not be compared with 15 July 2026."));
      else if (age < 0) checks.push(check("rule", "Bill age", "fail", "The bill date is after the case clock of 15 July 2026."));
      else if (age > 90) checks.push(check("rule", "Bill age", "fail", `The bill is ${age} days before 15 July 2026. Address proof must be no older than 90 days.`));
      else checks.push(check("rule", "Bill age", "pass", `The bill is ${age} days before 15 July 2026, inside the 90-day rule.`));
    }
    if (billed) {
      fields.billedTo = billed;
      const aligned = businessNamesAlign(billed, context.businessName);
      checks.push(check("rule", "Billed name", aligned ? "pass" : "review", aligned ? "The billed name aligns with the business name on this journey." : `Billed name “${billed}” does not align with ${context.businessName}.`));
    }
    checks.push(check("mock_registry", "Mock registry", "skipped", "Address proof is not a GSTIN or Udyam lookup."));
    checks.push(check("checksum", "Checksum", "skipped", "Address proof has no identifier checksum in this demo."));
  }

  if (kind === "signatory") {
    const flat = flatten(text);
    const name = flat.match(/Name\s+(.+?)\s+Designation/i)?.[1]?.trim() ?? "";
    const business = flat.match(/For business\s+(.+?)\s+ID no/i)?.[1]?.trim() ?? "";
    const idNumber = flat.match(/SYN-ID-\d{6}/)?.[0] ?? "";
    const validTill = flat.match(/Valid till\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "";
    if (!/signatory|syn-id|valid till/i.test(text)) {
      checks.push(check("ocr", "Signatory card", "review", "The image does not look like a readable signatory card."));
    } else {
      if (name) fields.signatory = name;
      if (business) fields.signatoryBusiness = business;
      if (idNumber) {
        fields.idNumber = idNumber;
        checks.push(check("ocr", "Specimen ID number", "pass", "A SYN-ID number was read. It is masked outside this step."));
        checks.push(check("checksum", "ID pattern", "pass", "The number matches the synthetic SYN-ID-###### pattern. It is not a government ID checksum."));
      } else {
        checks.push(check("ocr", "Specimen ID number", "fail", "The card looks readable and has no SYN-ID number."));
        checks.push(check("checksum", "ID pattern", "skipped", "Pattern check waits for a number."));
      }
      if (validTill) {
        fields.validTill = validTill;
        const age = ageInDays(validTill);
        if (age !== null && age > 0) checks.push(check("rule", "Validity", "fail", `The card expired on ${validTill}, before 15 July 2026.`));
        else checks.push(check("rule", "Validity", "pass", `Valid till ${validTill}, on or after the case clock.`));
      } else checks.push(check("rule", "Validity", "review", "No expiry date was read."));
      if (business) {
        const aligned = businessNamesAlign(business, context.businessName);
        checks.push(check("rule", "Business on card", aligned ? "pass" : "review", aligned ? "The business on the card aligns with this journey." : "The business on the card does not align with this journey."));
      }
    }
    checks.push(check("mock_registry", "Mock registry", "skipped", "The signatory card is not sent to the mock GST or Udyam files."));
  }

  const result = outcomeFrom(checks);
  const failed = checks.find((item) => item.status === "fail");
  const review = checks.find((item) => item.status === "review");
  const summary = failed?.detail || review?.detail || "OCR, format checks, and the rules that apply to this document passed.";
  return { kind, outcome: result, summary, checks, fields };
}

export function kycGate(documents: KycEvaluation[], attested: boolean): { status: string; reasons: string[] } {
  const required: DocKind[] = ["gst", "udyam", "address", "signatory"];
  const failed = documents.filter((doc) => doc.outcome === "failed");
  if (failed.length) return { status: "failed", reasons: failed.map((doc) => `${doc.kind}: ${doc.summary}`) };
  const missing = required.filter((kind) => !documents.some((doc) => doc.kind === kind));
  if (missing.length) return { status: "incomplete", reasons: [`Still needed: ${missing.join(", ")}.`] };
  const review = documents.filter((doc) => doc.outcome === "manual_review");
  if (review.length) return { status: "manual_review", reasons: review.map((doc) => `${doc.kind}: ${doc.summary}`) };
  const constitution = documents.find((doc) => doc.kind === "gst")?.fields.constitution ?? "";
  if (needsAuthorisation(constitution) && !attested) {
    return { status: "attestation_required", reasons: ["This constitution needs the signatory attestation before checkout. It is not an MCA or e-sign check."] };
  }
  return { status: "passed", reasons: ["All four documents passed the automated checks on this demo."] };
}
