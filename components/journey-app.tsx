"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AdvisorStatus } from "@/lib/generative";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inr, percent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { defaultQty } from "@/lib/quote";
import type { BusinessProfile, Quote, UiLanguage } from "@/lib/types";
import type { Recommendation } from "@/lib/recommend";

type SessionView = {
  id: string;
  consents: { purpose: string; granted: boolean }[];
  profile?: BusinessProfile;
  recommendation?: Recommendation;
  quote?: Quote;
  advisor: { role: string; text: string; mode?: string; generative: boolean; citations?: { id: string; name: string }[]; latencyMs?: number | null; model?: string | null; runtime?: string | null; fallbackReason?: string | null }[];
  kyc: { kind: string; fileName: string; ocrText: string; ocrOrientation: number; evaluation: { outcome: string; summary: string; checks: { layer: string; label: string; status: string; detail: string }[]; fields: Record<string, string> } }[];
  attested: boolean;
  review?: { decision: string; note: string };
  orderId?: string;
  handoffCode: string;
  specimens: { name: string; kind: string }[];
  kycStatus: { status: string; reasons: string[] };
};

const STEPS = ["consent", "business", "bundle", "advisor", "quote", "kyc", "checkout"] as const;
const SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"];
const BANDS = ["< 40 lakh", "40 lakh - 1.5 cr", "1.5 - 5 cr", "5 - 25 cr", "25 - 100 cr"];
const NETS = ["Business broadband", "Mobile hotspot", "Mixed per site", "Leased line", "Home broadband", "None"];

async function send(action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function granted(session: SessionView, purpose: string) {
  return session.consents.some((consent) => consent.purpose === purpose && consent.granted);
}

export function JourneyApp() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [step, setStep] = useState<(typeof STEPS)[number]>("consent");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BusinessProfile | null>(null);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus | null>(null);

  async function reload() {
    const response = await fetch("/api/session");
    const data = await response.json();
    setSession(data.session);
    if (data.session?.profile) setDraft(data.session.profile);
    return data.session as SessionView | null;
  }

  useEffect(() => {
    if (step !== "advisor") return;
    fetch("/api/advisor/status")
      .then((response) => response.json())
      .then(setAdvisorStatus)
      .catch(() => setAdvisorStatus(null));
  }, [step, session?.advisor.length]);

  useEffect(() => {
    reload()
      .then((loaded) => {
        if (!loaded) return;
        const consented = loaded.consents.some((consent) => consent.purpose === "discover" && consent.granted);
        if (!consented) setStep("consent");
        else if (!loaded.recommendation) setStep("business");
        else if (!loaded.quote) setStep("bundle");
        else if (loaded.kyc.length && !loaded.orderId) setStep("kyc");
        else if (!loaded.orderId) setStep("quote");
        else setStep("checkout");
      })
      .catch(() => setError("The session could not be loaded."));
  }, []);

  const lang: UiLanguage = draft?.uiLanguage || session?.profile?.uiLanguage || "en";
  const recommendation = session?.recommendation;
  const labels = useMemo(
    () => ({
      consent: t(lang, "consentTitle"),
      business: t(lang, "businessTitle"),
      bundle: t(lang, "recommendTitle"),
      advisor: t(lang, "advisorTitle"),
      quote: t(lang, "quoteTitle"),
      kyc: t(lang, "kycTitle"),
      checkout: t(lang, "payTitle"),
    }),
    [lang],
  );

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const data = await send(action, extra);
      if (data.session) {
        setSession(data.session);
        if (data.session.profile) setDraft(data.session.profile);
      } else await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session || !draft) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl">No demo session on this browser</h1>
        <p className="mt-2 text-muted-foreground">Pick a specimen business. The choice is stored as a cookie on this server, not only in the browser.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Choose a business</Link>
      </main>
    );
  }

  const objections = lang === "hi"
    ? ["यह बहुत महंगा है", "मुझे बस इंटरनेट चाहिए", "मेरा प्रदाता पहले से है", "इंस्टॉल में बहुत दिन लगेंगे", "अनुबंध बहुत लंबा है", "फिर से कागज?"]
    : ["This is too expensive", "I only need internet", "I already have a provider", "Installation will take too long", "The contract is too long", "Paperwork again?"];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">{draft.businessName || "New business"} · {draft.city}</p>
          <h1 className="font-display text-3xl">{labels[step]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="sim-pill">{t(lang, "caseClock")}</span>
          <Button variant="outline" className="h-9" onClick={() => run("forget").then(() => { window.location.href = "/"; })}>{t(lang, "startOver")}</Button>
        </div>
      </div>
      <div className="step-rail mt-4 flex gap-2 overflow-x-auto pb-2">
        {STEPS.map((item, index) => (
          <button key={item} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${step === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`} onClick={() => setStep(item)}>
            {index + 1}. {labels[item]}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {draft.assumptions.length ? <p className="mt-3 text-sm text-muted-foreground">{t(lang, "assumptions")}: {draft.assumptions.join(", ")}. Identity fields for a specimen are the pack values and are checked again by OCR.</p> : null}
      {draft.inSample ? <p className="mt-2 text-sm">This profile is an activated lead from the training quarter. A score from the saved full-data model is in-sample. The published metrics are out of fold.</p> : null}

      {step === "consent" ? (
        <section className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5">
          <p>{t(lang, "consentBody")}</p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5 size-5" checked={granted(session, "discover")} onCheckedChange={(value) => run("consent", { purpose: "discover", granted: value === true })} />
            <span>{t(lang, "consentCheck")}</span>
          </label>
          <Button className="mt-4 h-11" disabled={!granted(session, "discover")} onClick={() => setStep("business")}>{t(lang, "continue")}</Button>
        </section>
      ) : null}

      {step === "business" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Business" value={draft.businessName} onChange={(value) => setDraft({ ...draft, businessName: value })} />
          <Field label="Contact" value={draft.contactName} onChange={(value) => setDraft({ ...draft, contactName: value })} />
          <Field label="Role" value={draft.contactRole} onChange={(value) => setDraft({ ...draft, contactRole: value })} />
          <Field label="City" value={draft.city} onChange={(value) => setDraft({ ...draft, city: value })} />
          <SelectField label="Segment" value={draft.segment} options={SEGMENTS} onChange={(value) => setDraft({ ...draft, segment: value })} />
          <SelectField label="Turnover" value={draft.turnover} options={BANDS} onChange={(value) => setDraft({ ...draft, turnover: value })} />
          <Field label="Employees" value={String(draft.employees)} onChange={(value) => setDraft({ ...draft, employees: Number(value) })} />
          <Field label="Sites" value={String(draft.sites)} onChange={(value) => setDraft({ ...draft, sites: Number(value) })} />
          <Field label="Monthly telecom spend (INR)" value={String(draft.spend)} onChange={(value) => setDraft({ ...draft, spend: Number(value) })} />
          <SelectField label="Current internet" value={draft.internet} options={NETS} onChange={(value) => setDraft({ ...draft, internet: value })} />
          <Field label="GSTIN" value={draft.gstin} onChange={(value) => setDraft({ ...draft, gstin: value.toUpperCase(), claimsGstin: value.length > 0 })} />
          <Field label="Udyam" value={draft.udyam} onChange={(value) => setDraft({ ...draft, udyam: value.toUpperCase(), claimsUdyam: value.length > 0 })} />
          <SelectField label="Interface" value={draft.uiLanguage} options={["en", "hi"]} onChange={(value) => setDraft({ ...draft, uiLanguage: value as UiLanguage })} />
          <Field label="Preferred language (stored, not auto-translated beyond Hindi)" value={draft.language} onChange={(value) => setDraft({ ...draft, language: value })} />
          <div className="md:col-span-2">
            <Button className="h-11" disabled={busy || !granted(session, "discover")} onClick={async () => { await run("profile", { profile: draft }); await run("recommend"); setStep("bundle"); }}>Score the catalogue</Button>
          </div>
        </section>
      ) : null}

      {step === "bundle" && !recommendation ? <p className="mt-6 text-sm">Score the catalogue from the business step. Discovery consent has to be on.</p> : null}
      {step === "bundle" && recommendation ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{recommendation.engine === "hist_gradient_boosting" ? "Gradient boosting ranker" : "Segment popularity fallback"}</Badge>
            <Badge variant="outline">{recommendation.gstActive ? "Mock GSTIN active" : "No active mock GSTIN"}</Badge>
            <span className="sim-pill">Model rank and dependency closure are separate</span>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{recommendation.distinction} A score estimates whether an activated business included the product. It is not the chance this lead will buy.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["3", "5"] as const).map((slot) => (
              <article key={slot} className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-display text-2xl">{slot}-product bundle</h2>
                <p className="text-sm text-muted-foreground">Assembled on its own. Not a prefix of the other bundle.</p>
                <ul className="mt-3 space-y-3">
                  {recommendation.bundles[slot].items.map((item) => (
                    <li key={item.id} className="border-t border-border pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{item.name}</strong>
                        <Badge variant="outline">{item.id}</Badge>
                        <Badge variant={item.origin === "dependency_base" ? "secondary" : "default"}>{item.origin === "dependency_base" ? "Added for a dependency" : `Model rank ${item.rank}`}</Badge>
                      </div>
                      <p className="mt-1 text-sm">{item.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{inr(item.priceMin)} floor · band to {inr(item.priceMax)} · setup {inr(item.setup)} · {item.installDays} typical days · score {item.score.toFixed(2)} · {percent(item.segmentRate)} of activated peers in this segment bought it</p>
                      {item.satisfiedBy ? <p className="text-sm">Needs one of {item.requiresOneOf.join(", ")}. Satisfied here by {item.satisfiedBy}.</p> : null}
                    </li>
                  ))}
                </ul>
                <Button className="mt-4 h-11" disabled={busy} onClick={async () => {
                  const lines = recommendation.bundles[slot].items.map((item) => ({ id: item.id, qty: defaultQty(item.unit, draft.employees, draft.sites), origin: item.origin }));
                  await run("quote", { lines });
                  setStep("quote");
                }}>Use this bundle</Button>
              </article>
            ))}
          </div>
          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold">Products the rules kept out ({recommendation.blocked.length})</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {recommendation.blocked.map((item) => <li key={item.id}><strong>{item.id} {item.name}.</strong> {item.reasons.join(" ")}</li>)}
            </ul>
          </details>
        </section>
      ) : null}

      {step === "advisor" ? (
        <section className="mt-6 max-w-3xl">
          {advisorStatus?.loaded ? (
            <p className="sim-pill">Loaded {advisorStatus.model} {advisorStatus.quant} · {advisorStatus.runtime} · CPU · each reply is labelled generated or fallback</p>
          ) : (
            <p className="sim-pill">Generative model not loaded · replies below are the deterministic fallback</p>
          )}
          <div className="mt-4 space-y-3">
            {session.advisor.map((message, index) => (
              <article key={index} className={`rounded-2xl border p-4 ${message.role === "advisor" ? "border-border bg-card" : "border-transparent bg-secondary"}`}>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {message.role === "advisor"
                    ? message.generative
                      ? `${t(lang, "generated")} · ${message.model} · ${message.latencyMs} ms`
                      : `${t(lang, "composer")}${message.fallbackReason ? ` · ${message.fallbackReason}` : ""}`
                    : "Owner"}
                </p>
                {message.role === "advisor" ? <p className="mt-1 text-xs text-muted-foreground">{message.generative ? t(lang, "modelNote") : t(lang, "notModel")}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm">{message.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {objections.map((item) => <Button key={item} variant="outline" className="h-10" disabled={busy} onClick={() => run("advisor", { message: item })}>{item}</Button>)}
          </div>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (note.trim()) { run("advisor", { message: note }); setNote(""); } }}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ask about a product, the price, or the term" className="min-h-16" />
            <Button className="h-11" disabled={busy}>Ask</Button>
          </form>
        </section>
      ) : null}

      {step === "quote" ? <QuoteStep session={session} busy={busy} lang={lang} onSave={(lines) => run("quote", { lines })} /> : null}

      {step === "kyc" ? (
        <section className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
            <Checkbox className="mt-0.5 size-5" checked={granted(session, "kyc")} onCheckedChange={(value) => run("consent", { purpose: "kyc", granted: value === true })} />
            <span>{t(lang, "kycConsent")}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {session.specimens.map((specimen) => (
              <button key={specimen.name} className="rounded-xl border border-border bg-card p-3 text-left disabled:opacity-50" disabled={!granted(session, "kyc") || busy} onClick={async () => {
                setBusy(true);
                setError("");
                const body = new FormData();
                body.set("specimen", specimen.name);
                const response = await fetch("/api/kyc", { method: "POST", body });
                const data = await response.json();
                setBusy(false);
                if (!response.ok) setError(data.error || "OCR failed");
                else await reload();
              }}>
                <span className="text-xs text-muted-foreground">{specimen.kind}</span>
                <span className="mt-1 block font-semibold">Run OCR on {specimen.name.replaceAll("_", " ")}</span>
              </button>
            ))}
          </div>
          {session.kyc.map((doc) => (
            <article key={doc.kind} className="grid gap-4 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[220px_1fr]">
              {doc.fileName.endsWith(".png") ? (
                <Image unoptimized src={`/api/specimens/${doc.fileName}`} alt="" width={220} height={280} className="max-h-64 w-full rounded-lg border border-border object-contain" />
              ) : (
                <Image unoptimized src={`/api/kyc?kind=${doc.kind}`} alt="" width={220} height={280} className="max-h-64 w-full rounded-lg border border-border object-contain" />
              )}
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{doc.evaluation.outcome.replaceAll("_", " ")}</Badge>
                  <Badge variant="outline">OCR orientation {doc.ocrOrientation}°</Badge>
                </div>
                <p className="mt-2 text-sm">{doc.evaluation.summary}</p>
                <ul className="mt-3 space-y-2">
                  {doc.evaluation.checks.map((check, index) => (
                    <li key={index} className="text-sm">
                      <Badge variant="outline">{check.layer}</Badge> <strong>{check.label}</strong> · {check.status}. {check.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
          <p className="text-sm">Automated KYC status: <strong>{session.kycStatus.status.replaceAll("_", " ")}</strong>. {session.kycStatus.reasons.join(" ")}</p>
          {session.kycStatus.status === "attestation_required" || session.kyc.some((doc) => /llp|private limited/i.test(doc.evaluation.fields.constitution || "")) ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5 size-5" checked={session.attested} onCheckedChange={(value) => run("attest", { attested: value === true })} />
              <span>{t(lang, "attest")}</span>
            </label>
          ) : null}
          {session.review ? <p className="text-sm">Demo desk decision: {session.review.decision}. {session.review.note}</p> : null}
          <Button className="h-11" onClick={() => setStep("checkout")}>Continue to checkout</Button>
        </section>
      ) : null}

      {step === "checkout" ? (
        <section className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="sim-pill">{t(lang, "checkoutNoCharge")}</p>
          <p className="text-sm">Quote {session.quote?.valid ? "passed dependency and eligibility checks" : "is not valid yet"}. KYC is {session.kycStatus.status.replaceAll("_", " ")}{session.review ? `, reviewer ${session.review.decision}` : ""}.</p>
          {session.quote ? <p className="font-display text-3xl">{inr(session.quote.monthlyPretax)}<span className="text-base text-muted-foreground"> / month pre-tax</span></p> : null}
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5 size-5" checked={granted(session, "order")} onCheckedChange={(value) => run("consent", { purpose: "order", granted: value === true })} />
            <span>{t(lang, "orderConsent")}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5 size-5" checked={ack} onCheckedChange={(value) => setAck(value === true)} />
            <span>{t(lang, "checkoutAck")}</span>
          </label>
          <Button className="h-11" disabled={busy || !ack || !granted(session, "order")} onClick={() => run("checkout", { acknowledge: true })}>{t(lang, "createOrder")}</Button>
          {session.orderId ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <Link className="underline" href={`/track/${session.orderId}`}>{t(lang, "openTracker")} {session.orderId}</Link>
              <Link className="underline" href={`/handoff/${session.handoffCode}`}>{t(lang, "openHandoff")}</Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <Label className="mb-1 block">{label}</Label>
      <Input className="h-11 text-base" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <Label className="mb-1 block">{label}</Label>
      <select className="h-11 w-full rounded-lg border border-input bg-card px-3" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function QuoteStep({ session, busy, lang, onSave }: { session: SessionView; busy: boolean; lang: UiLanguage; onSave: (lines: { id: string; qty: number; origin?: string }[]) => Promise<void> }) {
  const quote = session.quote;
  const ranked = session.recommendation?.ranked || [];
  const [pick, setPick] = useState(ranked[0]?.id || "P01");
  if (!quote) return <p className="mt-6 text-sm">Choose a bundle first.</p>;
  const lines = quote.lines.map((line) => ({ id: line.id, qty: line.qty, origin: line.origin }));
  const saveQty = (id: string, qty: number) => onSave(lines.map((line) => line.id === id ? { ...line, qty } : line));
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        {quote.lines.map((line) => (
          <article key={line.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{line.name}</strong>
              <Badge variant="outline">{line.id}</Badge>
              {line.origin === "dependency_base" ? <Badge variant="secondary">Dependency base</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Floor {inr(line.priceMin)} · band to {inr(line.priceMax)} · {line.unit} · setup {inr(line.setup / Math.max(line.qty, 1))} each · {line.installDays} days · {line.contractMonths}-month minimum</p>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" className="size-11" onClick={() => saveQty(line.id, line.qty - 1)} disabled={busy}>−</Button>
              <span className="w-10 text-center">{line.qty}</span>
              <Button variant="outline" className="size-11" onClick={() => saveQty(line.id, line.qty + 1)} disabled={busy}>+</Button>
              <Button variant="ghost" onClick={() => onSave(lines.filter((item) => item.id !== line.id))} disabled={busy}>{t(lang, "removeLine")}</Button>
            </div>
          </article>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="h-11 rounded-lg border border-input bg-card px-3" value={pick} onChange={(event) => setPick(event.target.value)}>
            {ranked.map((item) => <option key={item.id} value={item.id}>{item.id} {item.name}</option>)}
          </select>
          <Button className="h-11" disabled={busy || lines.some((line) => line.id === pick)} onClick={() => {
            const item = ranked.find((entry) => entry.id === pick);
            onSave([...lines, { id: pick, qty: defaultQty(item?.unit || "per account", session.profile?.employees || 1, session.profile?.sites || 1), origin: "owner" }]);
          }}>Add line</Button>
        </div>
        {quote.problems.length ? (
          <div className="rounded-xl border border-destructive/40 bg-card p-4 text-sm">
            <p className="font-semibold">{t(lang, "quoteBlocked")}</p>
            <ul className="mt-2 list-disc pl-5">{quote.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : <p className="text-sm">{t(lang, "quoteOk")}</p>}
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Pre-tax monthly</p>
        <p className="font-display text-3xl">{inr(quote.monthlyPretax)}</p>
        <p className="mt-2 text-sm">Illustrative 18% {inr(quote.monthlyTax)}</p>
        <p className="mt-3 text-sm text-muted-foreground">Pre-tax setup</p>
        <p className="text-xl">{inr(quote.setupPretax)}</p>
        <p className="mt-3 text-sm">Term {quote.contractMonths} months · slowest install {quote.installDays} days · planning date {quote.activationDate}</p>
        <p className="mt-3 text-xs text-muted-foreground">{quote.priceRule}</p>
        <p className="mt-2 text-xs text-muted-foreground">{quote.taxNote}</p>
        <a className="mt-4 inline-block text-sm underline" href="/api/quote/pdf">Download quote PDF</a>
      </aside>
    </section>
  );
}
