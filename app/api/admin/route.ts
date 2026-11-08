import fs from "fs";
import { deskAuthorized } from "@/lib/access";
import { tickClock } from "@/lib/clock";
import { maskGstin, maskUdyam } from "@/lib/gstin";
import { json } from "@/lib/http";
import { kycGate } from "@/lib/kyc";
import { uploadRoot } from "@/lib/paths";
import { readStore, updateStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowed(request: Request) {
  return deskAuthorized(request.headers.get("x-demo-desk-key"));
}

export async function GET(request: Request) {
  if (!allowed(request)) return json({ error: "Demo desk key required." }, 403);
  const store = readStore();
  const sessions = Object.values(store.sessions).map((session) => ({
    id: session.id,
    businessName: session.profile?.businessName || "Withdrawn",
    city: session.profile?.city || "",
    personaId: session.profile?.personaId || "",
    gstin: session.profile?.gstin ? maskGstin(session.profile.gstin) : "",
    udyam: session.profile?.udyam ? maskUdyam(session.profile.udyam) : "",
    orderId: session.orderId || "",
    handoffCode: session.handoffCode,
    withdrawn: session.withdrawn,
    kyc: kycGate(session.kyc.map((doc) => doc.evaluation), session.attested),
    review: session.review || null,
    consents: session.consents.map((consent) => consent.purpose),
  }));
  return json({
    sessions,
    orders: Object.values(store.orders),
    audit: store.audit.slice(-40),
  });
}

export async function POST(request: Request) {
  if (!allowed(request)) return json({ error: "Demo desk key required." }, 403);
  const body = (await request.json().catch(() => null)) as { action?: string; sessionId?: string; decision?: string; note?: string } | null;
  if (body?.action === "wipe") {
    await updateStore((store) => {
      store.sessions = {};
      store.orders = {};
      store.audit.push({ event: "wiped", caseTime: new Date().toISOString(), detail: "demo desk" });
    });
    fs.rmSync(uploadRoot(), { recursive: true, force: true });
    return json({ ok: true });
  }
  if (body?.action === "review") {
    if (!body.sessionId || (body.decision !== "approved" && body.decision !== "rejected")) {
      return json({ error: "Review needs a session and a decision." }, 400);
    }
    try {
      const review = await updateStore((store) => {
        const session = store.sessions[body.sessionId!];
        if (!session) throw new Error("Session not found");
        session.review = {
          decision: body.decision as "approved" | "rejected",
          note: String(body.note || "").slice(0, 400),
          caseTime: tickClock(session),
          actor: "demo-desk",
        };
        store.audit.push({ event: "human_review", caseTime: session.review.caseTime, sessionId: session.id, detail: body.decision });
        return session.review;
      });
      return json({ review });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Review failed" }, 400);
    }
  }
  return json({ error: "Unknown desk action" }, 400);
}
