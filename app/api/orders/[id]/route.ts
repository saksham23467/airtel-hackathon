import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { canAdvanceOrder, canReadOrder, classifyOrderAccess, deskAuthorized } from "@/lib/access";
import { tickClock } from "@/lib/clock";
import { json } from "@/lib/http";
import { maskGstin, maskUdyam } from "@/lib/gstin";
import { readStore, updateStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEXT: Record<string, { type: string; label: string; detail: string; status: string } | undefined> = {
  work_order_queued: {
    type: "survey_booked",
    label: "Site survey booked in the simulation",
    detail: "A planner marked a survey. No technician was dispatched.",
    status: "survey_booked",
  },
  survey_booked: {
    type: "install_slot",
    label: "Install slot held in the simulation",
    detail: "The slot is a demo marker. It is not a field-force appointment.",
    status: "install_slot",
  },
  install_slot: {
    type: "simulated_activated",
    label: "Marked activated inside the simulation",
    detail: "No circuit, SIM or cloud tenant was provisioned.",
    status: "simulated_activated",
  },
};

async function actorFor(request: Request, orderSessionId: string) {
  const jar = await cookies();
  return classifyOrderAccess({
    desk: deskAuthorized(request.headers.get("x-demo-desk-key")),
    cookieSessionId: jar.get("udyam_sid")?.value || null,
    orderSessionId,
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = readStore();
  const order = store.orders[id];
  if (!order) return json({ error: "Order not found" }, 404);
  const actor = await actorFor(request, order.sessionId);
  if (!canReadOrder(actor)) return json({ error: "You cannot read this order." }, 403);
  const session = store.sessions[order.sessionId];
  return json({
    order,
    handoffCode: order.handoffCode,
    activationDate: order.quote.activationDate,
    uiLanguage: session?.profile?.uiLanguage === "hi" ? "hi" : "en",
    masked: session?.profile
      ? { gstin: maskGstin(session.profile.gstin), udyam: session.profile.udyam ? maskUdyam(session.profile.udyam) : "" }
      : null,
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = readStore().orders[id];
  if (!existing) return json({ error: "Order not found" }, 404);
  const actor = await actorFor(request, existing.sessionId);
  if (!canAdvanceOrder(actor)) return json({ error: "You cannot record a milestone on this order." }, 403);
  const body = (await request.json().catch(() => null)) as { advance?: boolean } | null;
  if (!body?.advance) return json({ error: "Nothing to record." }, 400);
  try {
    const order = await updateStore((store) => {
      const current = store.orders[id];
      if (!current) throw new Error("Order not found");
      const next = NEXT[current.status];
      if (!next) throw new Error("The simulation has no further milestone.");
      const session = store.sessions[current.sessionId];
      current.events.push({
        id: randomBytes(3).toString("hex"),
        type: next.type,
        label: next.label,
        detail: next.detail,
        caseTime: session ? tickClock(session) : current.createdCaseTime,
        recordedAt: new Date().toISOString(),
        simulated: true,
      });
      current.status = next.status;
      store.audit.push({ event: "simulated_milestone", caseTime: current.events.at(-1)!.caseTime, sessionId: current.sessionId, detail: next.type });
      return current;
    });
    return json({ order });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not record the milestone" }, 400);
  }
}
