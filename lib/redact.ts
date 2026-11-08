import { maskGstin, maskSynId, maskUdyam } from "@/lib/gstin";

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g;
const UDYAM = /UDYAM-[A-Z]{2}-\d{2}-\d{7}/g;

export function redact(value: string): string {
  return maskSynId(value.replace(UDYAM, (match) => maskUdyam(match)).replace(GSTIN, (match) => maskGstin(match)));
}

export function audit(event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = { event };
  for (const [key, field] of Object.entries(fields)) {
    if (typeof field === "string") safe[key] = redact(field);
    else if (typeof field === "number" || typeof field === "boolean" || field == null) safe[key] = field;
    else safe[key] = redact(JSON.stringify(field));
  }
  console.info(JSON.stringify(safe));
  return safe;
}
