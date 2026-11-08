"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Order, UiLanguage } from "@/lib/types";

function deskHeaders(): HeadersInit {
  const key = window.sessionStorage.getItem("udyam-desk-key");
  return key ? { "x-demo-desk-key": key } : {};
}

export function TrackerApp({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [lang, setLang] = useState<UiLanguage>("en");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/orders/${id}`, { headers: deskHeaders() });
    const data = await response.json();
    if (response.status === 403) {
      setForbidden(true);
      setError(data.error || "forbidden");
      setOrder(null);
      return;
    }
    if (!response.ok) {
      setForbidden(false);
      setError(data.error || "missing");
      return;
    }
    setForbidden(false);
    setError("");
    setLang(data.uiLanguage === "hi" ? "hi" : "en");
    setOrder(data.order);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p>{forbidden ? t(lang, "trackerForbidden") : t(lang, "trackerMissing")}</p>
      </main>
    );
  }
  if (!order) return <main className="mx-auto max-w-3xl px-4 py-12">{t(lang, "trackerLoading")}</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="sim-pill">{t(lang, "trackerSim")}</p>
      <h1 className="font-display mt-3 text-4xl">{order.id}</h1>
      <p className="mt-2 text-muted-foreground">{order.businessName}, {order.city}. {t(lang, "trackerPay")} {order.paymentRef}. {t(lang, "trackerNoMoney")}</p>
      <p className="mt-4 text-sm">{t(lang, "trackerPlan")} {order.quote.activationDate}. {order.quote.installDays} {t(lang, "trackerSlowest")}</p>
      <p className="mt-2 font-display text-3xl">{inr(order.quote.monthlyPretax)} <span className="text-base text-muted-foreground">{t(lang, "trackerMonth")}</span></p>
      <ol className="mt-6 space-y-4 border-l border-border pl-4">
        {order.events.map((event) => (
          <li key={event.id}>
            <p className="text-xs text-muted-foreground">{new Date(event.caseTime).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata" })} · simulated</p>
            <p className="font-semibold">{event.label}</p>
            <p className="text-sm">{event.detail}</p>
          </li>
        ))}
      </ol>
      <Button className="mt-6 h-11" onClick={async () => {
        const response = await fetch(`/api/orders/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...deskHeaders() },
          body: JSON.stringify({ advance: true }),
        });
        const data = await response.json();
        if (response.status === 403) {
          setForbidden(true);
          setError(data.error || "forbidden");
          return;
        }
        if (!response.ok) setError(data.error || "No further milestone");
        else { setError(""); setForbidden(false); setOrder(data.order); }
      }}>{t(lang, "trackerNext")}</Button>
      <p className="mt-4 text-sm"><Link className="underline" href={`/handoff/${order.handoffCode}`}>{t(lang, "trackerHandoff")}</Link></p>
    </main>
  );
}
