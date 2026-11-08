"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { personaCards } from "@/lib/persona-cards";

const tone: Record<string, string> = {
  pass: "Pass path",
  fail: "Failure path",
  review: "Manual review",
  rules: "Eligibility rules",
};

export function HomeApp() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const cards = personaCards;

  async function start(personaId: string) {
    setBusy(personaId);
    setError("");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", personaId }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Could not start the session.");
      return;
    }
    router.push("/journey");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">YTL AIRTEL SYNC 2026 · TRACK A · IIIT DELHI</p>
      <h1 className="font-display mt-3 max-w-3xl text-4xl leading-tight sm:text-6xl">A small business can leave with one quote.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Accel Business is the fictional operator. This sitting scores the supplied catalogue, closes product dependencies, prices the floor of each band, reads the specimen documents with Tesseract, and keeps the order on this server.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="sim-pill">Case clock 15 Jul 2026</span>
        <span className="sim-pill">Mock GSTIN and Udyam files</span>
        <span className="sim-pill">No payment collected</span>
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.filter((card) => card.primary).map((card) => (
          <article key={card.id} className="rounded-2xl border border-border bg-card p-5">
            <Badge variant="outline">{tone[card.tone]}</Badge>
            <h2 className="font-display mt-3 text-2xl">{card.title}</h2>
            <p className="text-sm text-muted-foreground">{card.place}</p>
            <p className="mt-2 text-sm">{card.story}</p>
            <Button className="mt-4 h-11" disabled={busy === card.id} onClick={() => start(card.id)}>
              {busy === card.id ? "Starting…" : `Open ${card.title}`}
            </Button>
          </article>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.filter((card) => !card.primary).map((card) => (
          <button key={card.id} className="rounded-xl border border-border bg-card p-4 text-left hover:bg-accent" onClick={() => start(card.id)} disabled={Boolean(busy)}>
            <span className="text-xs text-muted-foreground">{tone[card.tone]}</span>
            <span className="mt-1 block font-semibold">{card.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{card.story}</span>
          </button>
        ))}
        <button className="rounded-xl border border-dashed border-border p-4 text-left hover:bg-accent" onClick={() => start("blank")} disabled={Boolean(busy)}>
          <span className="text-xs text-muted-foreground">Empty form</span>
          <span className="mt-1 block font-semibold">Start without a specimen</span>
          <span className="mt-1 block text-sm text-muted-foreground">Jaipur tier comes from the lead file. Size fields are still defaults you can edit.</span>
        </button>
      </div>
      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        0xAlpha, IIIT Delhi. Identifier numbers in this demo are the fictional pack. Do not upload a real GST certificate, Udyam printout or photo ID.
      </p>
    </main>
  );
}
