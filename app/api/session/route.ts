import { randomBytes } from "crypto";
import fs from "fs";
import { loadCatalogue, TURNOVER_BANDS } from "@/lib/catalogue";
import { caseStamp, hasConsent, tickClock } from "@/lib/clock";
import { CONSENT_VERSION } from "@/lib/gstin";
import { resolveAdvice } from "@/lib/generative";
import { clearSessionCookie, currentSession, json, setSessionCookie } from "@/lib/http";
import { blankProfile, materialisePersona, personaPack } from "@/lib/personas";
import { buildQuote } from "@/lib/quote";
import { recommendFor } from "@/lib/recommend";
import { audit } from "@/lib/redact";
import { specimensForPack } from "@/lib/specimens";
import { updateStore } from "@/lib/store";
import { kycGate } from "@/lib/kyc";
import { presentEvaluation, presentGate } from "@/lib/kyc-present";
import { gstActiveForProfile, segmentKey } from "@/lib/personas";
import type { BusinessProfile, ConsentPurpose, Order, Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"];

function publicSession(session: Session) {
  return {
    id: session.id,
    consents: session.consents,
    profile: session.profile,
    recommendation: session.recommendation,
    quote: session.quote,
    advisor: session.advisor,
    kyc: session.kyc.map((doc) => ({
      kind: doc.kind,
      source: doc.source,
      fileName: doc.fileName,
      ocrOrientation: doc.ocrOrientation,
      ocrText: doc.ocrText,
      evaluation: presentEvaluation(doc.evaluation, session.profile?.uiLanguage === "hi" ? "hi" : "en"),
    })),
    attested: session.attested,
    review: session.review,
    withdrawn: session.withdrawn,
    orderId: session.orderId,
    handoffCode: session.handoffCode,
    handoffNotes: session.handoffNotes,
    specimens: specimensForPack(personaPack(session.profile?.personaId || "") || ""),
    kycStatus: presentGate(kycGate(session.kyc.map((doc) => doc.evaluation), session.attested), session.profile?.uiLanguage === "hi" ? "hi" : "en"),
  };
}

function cleanProfile(input: BusinessProfile, previous?: BusinessProfile): BusinessProfile {
  const employees = Math.round(Number(input.employees));
  const sites = Math.round(Number(input.sites));
  const spend = Number(input.spend);
  const tier = Number(input.tier);
  if (!SEGMENTS.includes(input.segment)) throw new Error("Choose one of the four segments.");
  if (!TURNOVER_BANDS.includes(input.turnover)) throw new Error("Choose a turnover band from the lead file.");
  if (!Number.isFinite(employees) || employees < 1 || employees > 5000) throw new Error("Employees must be between 1 and 5000.");
  if (!Number.isFinite(sites) || sites < 1 || sites > 200) throw new Error("Sites must be between 1 and 200.");
  if (!Number.isFinite(spend) || spend < 0 || spend > 10_000_000) throw new Error("Spend is out of range.");
  if (tier !== 1 && tier !== 2) throw new Error("City tier must be 1 or 2.");
  const known = new Set(loadCatalogue().map((product) => product.id));
  return {
    ...input,
    employees,
    sites,
    spend,
    tier,
    gstin: String(input.gstin || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    udyam: String(input.udyam || "").toUpperCase().replace(/\s+/g, ""),
    uiLanguage: input.uiLanguage === "hi" ? "hi" : "en",
    interests: (input.interests || []).filter((id) => known.has(id)),
    inSample: previous?.leadId && previous.leadId === input.leadId ? previous.inSample : false,
    assumptions: input.assumptions || previous?.assumptions || [],
  };
}

export async function GET() {
  const session = await currentSession();
  return json({ session: session ? publicSession(session) : null });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { action?: string; [key: string]: unknown } | null;
  if (!body?.action) return json({ error: "Missing action" }, 400);
  try {
    if (body.action === "start") {
      const personaId = String(body.personaId || "blank");
      const profile = personaId === "blank" ? blankProfile() : materialisePersona(personaId);
      const id = randomBytes(8).toString("hex");
      const session: Session = {
        id,
        createdCaseTime: caseStamp(0),
        clock: 0,
        consents: [],
        profile,
        advisor: [],
        kyc: [],
        attested: false,
        withdrawn: false,
        handoffCode: randomBytes(16).toString("hex"),
        handoffNotes: [],
        storedAt: new Date().toISOString(),
      };
      await updateStore((store) => {
        store.sessions[id] = session;
        store.audit.push({ event: "session_started", caseTime: session.createdCaseTime, sessionId: id, detail: personaId });
      });
      await setSessionCookie(id);
      audit("session_started", { sessionId: id, personaId });
      return json({ session: publicSession(session) });
    }

    const existing = await currentSession();
    if (!existing) return json({ error: "Start a demo session first." }, 401);

    if (body.action === "forget") {
      await updateStore((store) => {
        delete store.sessions[existing.id];
        store.audit.push({ event: "session_forgotten", caseTime: caseStamp(0), sessionId: existing.id });
      });
      await clearSessionCookie();
      return json({ ok: true });
    }

    const updated = await updateStore((store) => {
      const session = store.sessions[existing.id];
      if (!session || session.withdrawn && body.action !== "withdraw") throw new Error("This session was withdrawn.");
      if (body.action === "consent") {
        const purpose = String(body.purpose) as ConsentPurpose;
        if (!["discover", "kyc", "order"].includes(purpose)) throw new Error("Unknown consent purpose.");
        session.consents = session.consents.filter((consent) => consent.purpose !== purpose);
        session.consents.push({ purpose, version: CONSENT_VERSION, granted: Boolean(body.granted), caseTime: tickClock(session) });
        store.audit.push({ event: "consent", caseTime: caseStamp(session.clock), sessionId: session.id, detail: `${purpose}:${Boolean(body.granted)}` });
      } else if (body.action === "profile") {
        if (!hasConsent(session, "discover")) throw new Error("Discovery consent is required before the business profile is used.");
        session.profile = cleanProfile(body.profile as BusinessProfile, session.profile);
        session.recommendation = undefined;
      } else if (body.action === "attest") {
        session.attested = Boolean(body.attested);
      } else if (body.action === "quote") {
        if (!session.profile || !hasConsent(session, "discover")) throw new Error("Discovery consent is required before a quote.");
        const selections = (body.lines as { id: string; qty: number; origin?: "model" | "dependency_base" | "owner" }[]) || [];
        const products = loadCatalogue();
        const profile = session.profile;
        session.quote = buildQuote(selections, products, {
          segmentKey: segmentKey(profile.segment),
          tier: profile.tier,
          employees: profile.employees,
          sites: profile.sites,
          gstActive: gstActiveForProfile(profile),
        });
        for (const line of session.quote.lines) {
          if (!line.origin) line.origin = "owner";
        }
      } else if (body.action === "withdraw") {
        session.withdrawn = true;
        session.profile = undefined;
        session.recommendation = undefined;
        session.quote = undefined;
        session.advisor = [];
        for (const doc of session.kyc) {
          if (doc.storedAs && doc.source === "upload") fs.rmSync(doc.storedAs, { force: true });
          doc.ocrText = "";
          doc.evaluation.fields = {};
        }
        session.kyc = [];
        store.audit.push({ event: "withdrawn", caseTime: tickClock(session), sessionId: session.id, detail: "identifiers and OCR text removed" });
      } else if (body.action === "recommend" || body.action === "advisor") {
        if (!session.profile || !hasConsent(session, "discover")) throw new Error("Discovery consent is required.");
      } else if (body.action === "checkout") {
        if (!session.profile || !session.quote) throw new Error("Save a quote first.");
        if (!hasConsent(session, "discover") || !hasConsent(session, "kyc") || !hasConsent(session, "order")) {
          throw new Error("Discovery, KYC and order consents are all required.");
        }
        if (!body.acknowledge) throw new Error("Confirm that this checkout is simulated.");
        if (!session.quote.valid) throw new Error(session.quote.problems.join(" "));
        const gate = kycGate(session.kyc.map((doc) => doc.evaluation), session.attested);
        const approved = session.review?.decision === "approved";
        if (session.review?.decision === "rejected") throw new Error("A reviewer rejected this KYC.");
        if (!approved && gate.status !== "passed") throw new Error(gate.reasons.join(" "));
        const orderId = `AB-${randomBytes(4).toString("hex").toUpperCase()}`;
        const order: Order = {
          id: orderId,
          sessionId: session.id,
          handoffCode: session.handoffCode,
          businessName: session.profile.businessName,
          city: session.profile.city,
          quote: session.quote,
          paymentRef: `SIM-${randomBytes(3).toString("hex").toUpperCase()}`,
          status: "work_order_queued",
          events: [],
          createdCaseTime: tickClock(session),
          storedAt: new Date().toISOString(),
        };
        const add = (type: string, label: string, detail: string) => {
          order.events.push({
            id: randomBytes(3).toString("hex"),
            type,
            label,
            detail,
            caseTime: tickClock(session),
            recordedAt: new Date().toISOString(),
            simulated: true,
          });
        };
        add("order_accepted", "Quote accepted in the demo", "The owner accepted the simulated quote.");
        add("simulated_payment", "Simulated payment reference", `${order.paymentRef}. No money moved.`);
        add("kyc_recorded", "KYC decision recorded", approved ? "A demo-desk reviewer approved an exception." : "Automated checks passed.");
        add("work_order_queued", "Work order queued in the simulation", `Catalogue planning date ${session.quote.activationDate}. Nothing was sent to a network.`);
        order.status = "work_order_queued";
        store.orders[orderId] = order;
        session.orderId = orderId;
        store.audit.push({ event: "order_created", caseTime: order.createdCaseTime, sessionId: session.id, detail: orderId });
      } else {
        throw new Error("Unknown action");
      }
      return publicSession(session);
    });

    if (body.action === "recommend") {
      const session = await currentSession();
      if (!session?.profile || !hasConsent(session, "discover")) return json({ error: "Discovery consent is required before scoring." }, 403);
      const recommendation = await recommendFor(session.profile);
      const saved = await updateStore((store) => {
        store.sessions[session.id].recommendation = recommendation;
        store.audit.push({ event: "scored", caseTime: tickClock(store.sessions[session.id]), sessionId: session.id, detail: recommendation.engine });
        return publicSession(store.sessions[session.id]);
      });
      audit("scored", { sessionId: session.id, engine: recommendation.engine });
      return json({ session: saved });
    }

    if (body.action === "advisor") {
      const session = await currentSession();
      if (!session?.profile || !hasConsent(session, "discover")) return json({ error: "Discovery consent is required before the advisor." }, 403);
      const message = String(body.message || "").slice(0, 800);
      const focusIds = ((session.quote?.lines || []).map((line) => line.id).length
        ? session.quote!.lines.map((line) => line.id)
        : ((session.recommendation as { bundles?: { "3"?: { items?: { id: string }[] } } })?.bundles?.["3"]?.items || []).map((item) => item.id));
      const advice = await resolveAdvice({
        message,
        profile: session.profile,
        quote: session.quote || null,
        products: loadCatalogue(),
        focusIds,
      });
      const saved = await updateStore((store) => {
        const current = store.sessions[session.id];
        current.advisor.push({ role: "owner", text: message, generative: false, caseTime: tickClock(current) });
        current.advisor.push({
          role: "advisor",
          text: advice.text,
          mode: advice.mode,
          generative: advice.generative,
          caseTime: tickClock(current),
          citations: advice.citations,
          latencyMs: advice.latencyMs,
          model: advice.model,
          runtime: advice.runtime,
          fallbackReason: advice.fallbackReason,
        });
        return { session: publicSession(current), disclosure: advice.disclosure, advice };
      });
      return json(saved);
    }

    return json({ session: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    audit("session_error", { message });
    return json({ error: message }, 400);
  }
}

