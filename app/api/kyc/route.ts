import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { loadGstRegistry, loadUdyamRegistry } from "@/lib/catalogue";
import { hasConsent, tickClock } from "@/lib/clock";
import { currentSession, json } from "@/lib/http";
import { evaluateDocument } from "@/lib/kyc";
import { runOcr } from "@/lib/ocr";
import { uploadRoot } from "@/lib/paths";
import { audit } from "@/lib/redact";
import { kindFromSpecimen, specimenPath } from "@/lib/specimens";
import { updateStore } from "@/lib/store";
import type { DocKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function insideUploads(file: string): boolean {
  const root = path.resolve(uploadRoot());
  const target = path.resolve(file);
  return target.startsWith(root + path.sep);
}

export async function GET(request: Request) {
  const session = await currentSession();
  const kind = new URL(request.url).searchParams.get("kind");
  const doc = session?.kyc.find((item) => item.kind === kind);
  if (!doc) return new Response("Not found", { status: 404 });
  const file = doc.source === "specimen" ? specimenPath(doc.fileName) : doc.storedAs;
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const bytes = fs.readFileSync(file);
  const type = file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session?.profile) return json({ error: "Start a demo session first." }, 401);
  if (!hasConsent(session, "kyc")) return json({ error: "KYC consent is required before OCR or a mock lookup." }, 403);
  const form = await request.formData();
  const specimen = String(form.get("specimen") || "");
  const upload = form.get("file");
  let kind = String(form.get("kind") || "") as DocKind;
  let source: "specimen" | "upload" = "specimen";
  let fileName = specimen;
  let imagePath = "";
  let storedAs: string | undefined;

  if (specimen) {
    const resolved = specimenPath(specimen);
    const parsedKind = kindFromSpecimen(specimen);
    if (!resolved || !parsedKind) return json({ error: "That specimen is not in the supplied pack." }, 400);
    imagePath = resolved;
    kind = parsedKind;
  } else if (upload instanceof File) {
    if (upload.size > 4_000_000) return json({ error: "File is larger than 4 MB." }, 400);
    const bytes = Buffer.from(await upload.arrayBuffer());
    const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!png && !jpeg) return json({ error: "Only PNG or JPEG specimens are accepted." }, 400);
    if (!["gst", "udyam", "address", "signatory"].includes(kind)) return json({ error: "Choose a document type." }, 400);
    fs.mkdirSync(uploadRoot(), { recursive: true });
    const stored = path.join(uploadRoot(), `${randomBytes(8).toString("hex")}${png ? ".png" : ".jpg"}`);
    fs.writeFileSync(stored, bytes);
    imagePath = stored;
    storedAs = stored;
    fileName = "upload";
    source = "upload";
  } else {
    return json({ error: "Choose a specimen or a file." }, 400);
  }

  try {
    const ocr = await runOcr(imagePath);
    const evaluation = evaluateDocument(kind, ocr.text, {
      businessName: session.profile.businessName,
      gst: loadGstRegistry(),
      udyam: loadUdyamRegistry(),
    });
    const saved = await updateStore((store) => {
      const current = store.sessions[session.id];
      const previous = current.kyc.find((doc) => doc.kind === kind);
      if (previous?.storedAs && previous.source === "upload" && insideUploads(previous.storedAs)) fs.rmSync(previous.storedAs, { force: true });
      current.kyc = current.kyc.filter((doc) => doc.kind !== kind);
      current.kyc.push({
        kind,
        source,
        fileName,
        storedAs,
        ocrOrientation: ocr.orientation,
        ocrText: ocr.text,
        evaluation,
      });
      store.audit.push({
        event: "kyc_checked",
        caseTime: tickClock(current),
        sessionId: current.id,
        detail: `${kind}:${evaluation.outcome}`,
      });
      return current.kyc;
    });
    audit("kyc_checked", { sessionId: session.id, kind, outcome: evaluation.outcome });
    return json({ documents: saved });
  } catch (error) {
    audit("ocr_error", { message: error instanceof Error ? error.message : "ocr" });
    return json({ error: "OCR could not read that image." }, 500);
  }
}
