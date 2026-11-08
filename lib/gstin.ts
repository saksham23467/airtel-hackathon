export const CASE_TODAY = "2026-07-15";
export const CONSENT_VERSION = "udyam-demo-2026-07-15";

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAP_DIGIT: Record<string, string> = { O: "0", I: "1", L: "1", S: "5", Z: "2", B: "8", G: "6" };
const MAP_LETTER: Record<string, string> = { "0": "O", "1": "I", "5": "S", "2": "Z", "8": "B", "6": "G" };
const CONFUSABLE: Record<string, string> = {
  O: "0",
  "0": "O",
  I: "1",
  "1": "I",
  S: "5",
  "5": "S",
  B: "8",
  "8": "B",
  Z: "2",
  "2": "Z",
  T: "I",
  G: "6",
  "6": "G",
  L: "1",
};

export function gstinChecksumOk(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  const token = gstin.toUpperCase();
  let total = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = GST_CHARS.indexOf(token[i]);
    if (value < 0) return false;
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (total % 36)) % 36] === token[14];
}

function positionNormalize(token: string): string {
  let out = "";
  for (let i = 0; i < token.length; i += 1) {
    const char = token[i];
    if ([0, 1, 7, 8, 9, 10].includes(i)) out += MAP_DIGIT[char] ?? char;
    else if ([2, 3, 4, 5, 6, 11].includes(i)) out += MAP_LETTER[char] ?? char;
    else out += char;
  }
  return out;
}

export function checksumCandidates(token: string): string[] {
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const bases: string[] = [];
  if (clean.length === 15) bases.push(clean);
  else if (clean.length === 16) {
    for (let index = 0; index < 16; index += 1) bases.push(clean.slice(0, index) + clean.slice(index + 1));
  } else return [];

  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    if (gstinChecksumOk(value) && !seen.has(value)) {
      seen.add(value);
      found.push(value);
    }
  };
  for (const base of bases) {
    const normalized = positionNormalize(base);
    if (gstinChecksumOk(normalized)) add(normalized);
    else {
      for (let index = 0; index < normalized.length; index += 1) {
        const swap = CONFUSABLE[normalized[index]];
        if (!swap) continue;
        add(positionNormalize(normalized.slice(0, index) + swap + normalized.slice(index + 1)));
      }
    }
  }
  return found;
}

export function chooseGstinReading(
  token: string,
  inRegistry: (gstin: string) => boolean,
): { value: string | null; note: string } {
  const candidates = checksumCandidates(token);
  const raw = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (candidates.length === 1) {
    return {
      value: candidates[0],
      note: candidates[0] === raw ? "Checksum accepted the OCR token as read." : "Checksum accepted one repaired OCR reading. The repair is shown separately from the raw token.",
    };
  }
  if (candidates.length > 1) {
    const hits = candidates.filter(inRegistry);
    if (hits.length === 1) {
      return {
        value: hits[0],
        note: "More than one checksum-valid reading. The only reading present in the mock registry was kept. This is a tie-break, not a government match.",
      };
    }
    return { value: null, note: "More than one checksum-valid reading, and the mock registry did not leave a single candidate." };
  }
  return { value: null, note: "No checksum-valid GSTIN could be read from this token." };
}

export function gstinTokenFromOcr(text: string): string | null {
  const flat = text.toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  const match = flat.match(/\bGSTIN\s+([A-Z0-9]{14,18})\b/);
  return match ? match[1] : null;
}

export function normalizeUdyam(value: string): string | null {
  const match = value.toUpperCase().match(/UDYAM\s*-?\s*([A-Z]{2})\s*-?\s*(\d{2})\s*-?\s*(\d{7})/);
  if (!match) return null;
  return `UDYAM-${match[1]}-${match[2]}-${match[3]}`;
}

export function udyamFromOcr(text: string): { value: string | null; readableCertificate: boolean } {
  const flat = text.replace(/\s+/g, " ");
  const labelled = flat.match(/Udyam reg\.?\s*number\s*([A-Z0-9 \-]{0,48})/i);
  const window = labelled ? labelled[1] : "";
  const value = normalizeUdyam(window) || normalizeUdyam(flat);
  const readableCertificate = /udyam registration/i.test(text) && /enterprise name/i.test(text);
  return { value, readableCertificate };
}

export function ageInDays(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const today = Date.parse(`${CASE_TODAY}T00:00:00Z`);
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.round((today - then) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const then = new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000);
  return then.toISOString().slice(0, 10);
}

export function maskGstin(gstin: string): string {
  const token = gstin.trim().toUpperCase();
  if (token.length < 8) return "••••";
  return `${token.slice(0, 2)}••••••${token.slice(-3)}`;
}

export function maskUdyam(udyam: string): string {
  return udyam.replace(/(\d{3})(\d{4})$/, "•••$2");
}

export function maskSynId(value: string): string {
  return value.replace(/SYN-ID-\d{6}/g, "SYN-ID-••••••");
}
