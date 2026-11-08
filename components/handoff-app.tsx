"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/lib/types";

type Handoff = {
  businessName: string;
  city: string;
  segment: string;
  employees: number;
  sites: number;
  uiLanguage?: UiLanguage;
  gstin: string;
  udyam: string;
  quote?: { monthlyPretax: number; setupPretax: number; contractMonths: number; installDays: number; activationDate: string; lines: { id: string; name: string; qty: number; monthly: number }[] } | null;
  kycStatus: string;
  order?: { id: string; status: string; latest: string } | null;
  notes: { text: string }[];
  channel: string;
  route?: string;
};

export function HandoffApp({ code }: { code: string }) {
  const [data, setData] = useState<Handoff | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/handoff/${code}`);
    const body = await response.json();
    if (!response.ok) setError(body.error || "Handoff not found");
    else setData(body);
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const lang: UiLanguage = data?.uiLanguage === "hi" ? "hi" : "en";
  if (error) return <main className="mx-auto max-w-3xl px-4 py-12">{error}</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-4 py-12">{lang === "hi" ? "पार्टनर पेज लोड हो रहा है…" : "Loading the partner page…"}</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="sim-pill">{lang === "hi" ? "सिम्युलेशन रूट: फील्ड पार्टनर · कोई संदेश नहीं गया" : `Simulation route: ${data.route || "field-partner"} · no message sent`}</p>
      <h1 className="font-display mt-3 text-4xl">{data.businessName}</h1>
      <p className="mt-2 text-muted-foreground">{data.city} · {data.segment} · {data.employees} / {data.sites}</p>
      <p className="mt-4 text-sm">{data.channel}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted-foreground">GSTIN</dt><dd>{data.gstin || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Udyam</dt><dd>{data.udyam || "—"}</dd></div>
        <div><dt className="text-muted-foreground">KYC</dt><dd>{data.kycStatus}</dd></div>
      </dl>
      <h2 className="font-display mt-8 text-2xl">{t(lang, "quoteTitle")}</h2>
      {data.quote ? (
        <ul className="mt-2 text-sm">
          {data.quote.lines.map((line) => <li key={line.id}>{line.qty} × {line.name} · {inr(line.monthly)}</li>)}
          <li className="mt-2">{inr(data.quote.monthlyPretax)} {t(lang, "trackerMonth")} · {t(lang, "trackerPlan")} {data.quote.activationDate}</li>
        </ul>
      ) : <p className="text-sm">{lang === "hi" ? "कोट सेव नहीं है।" : "No quote saved."}</p>}
      {data.order ? <p className="mt-6 text-sm">{data.order.id} · {data.order.status}. {data.order.latest}</p> : null}
      <h2 className="font-display mt-8 text-2xl">{lang === "hi" ? "फील्ड नोट" : "Field note"}</h2>
      <ul className="mt-2 space-y-2 text-sm">{data.notes.map((item, index) => <li key={index}>{item.text}</li>)}</ul>
      <form className="mt-3 space-y-2" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch(`/api/handoff/${code}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) });
        const body = await response.json();
        if (!response.ok) setError(body.error || "Could not save");
        else { setNote(""); await load(); }
      }}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={lang === "hi" ? "विज़िट पर जो कहा गया" : "What the owner said on the visit"} />
        <Button className="h-11">{lang === "hi" ? "नोट सेव करें" : "Save note on this context"}</Button>
      </form>
    </main>
  );
}
