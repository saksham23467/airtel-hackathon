import { maskGstin, maskUdyam } from "@/lib/gstin";
import { kycGate } from "@/lib/kyc";
import type { Order, Session } from "@/lib/types";

/** Partner payload. The code is the bearer. It does not include contact names, advisor text, OCR, or the session id. */
export function handoffView(session: Session, order?: Order) {
  if (!session.profile || session.withdrawn) return null;
  const quote = session.quote;
  const gate = kycGate(session.kyc.map((doc) => doc.evaluation), session.attested);
  return {
    businessName: session.profile.businessName,
    city: session.profile.city,
    segment: session.profile.segment,
    employees: session.profile.employees,
    sites: session.profile.sites,
    uiLanguage: session.profile.uiLanguage === "hi" ? "hi" : "en",
    gstin: session.profile.gstin ? maskGstin(session.profile.gstin) : "",
    udyam: session.profile.udyam ? maskUdyam(session.profile.udyam) : "",
    quote: quote
      ? {
          monthlyPretax: quote.monthlyPretax,
          setupPretax: quote.setupPretax,
          contractMonths: quote.contractMonths,
          installDays: quote.installDays,
          activationDate: quote.activationDate,
          lines: quote.lines.map((line) => ({ id: line.id, name: line.name, qty: line.qty, monthly: line.monthly })),
        }
      : null,
    kycStatus: gate.status,
    order: order
      ? { id: order.id, status: order.status, latest: order.events.at(-1)?.label || "" }
      : null,
    notes: session.handoffNotes.map((note) => ({ text: note.text })),
    route: "field-partner",
    channel: "Simulation route: field-partner page for this segment and city. Nothing was sent by SMS, WhatsApp or email.",
  };
}
