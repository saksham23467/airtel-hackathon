import { tickClock } from "@/lib/clock";
import { handoffView } from "@/lib/handoff-view";
import { json } from "@/lib/http";
import { readStore, updateStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function findSession(code: string) {
  if (!code || code.length < 8) return undefined;
  return Object.values(readStore().sessions).find((session) => session.handoffCode === code);
}

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const session = findSession(code);
  if (!session) return json({ error: "Handoff not found" }, 404);
  const order = session.orderId ? readStore().orders[session.orderId] : undefined;
  const view = handoffView(session, order);
  if (!view) return json({ error: "Handoff not found" }, 404);
  return json(view);
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const body = (await request.json().catch(() => null)) as { note?: string } | null;
  const note = String(body?.note || "").trim().slice(0, 240);
  if (!note) return json({ error: "Write a note for the shared context." }, 400);
  try {
    const notes = await updateStore((store) => {
      const session = Object.values(store.sessions).find((item) => item.handoffCode === code && code.length >= 8);
      if (!session) throw new Error("Handoff not found");
      session.handoffNotes.push({ text: note, caseTime: tickClock(session), role: "partner" });
      store.audit.push({ event: "handoff_note", caseTime: session.handoffNotes.at(-1)!.caseTime, sessionId: session.id, detail: "partner note" });
      return session.handoffNotes.map((item) => ({ text: item.text }));
    });
    return json({ notes });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save the note" }, 400);
  }
}
