"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, percent } from "@/lib/format";

type Evidence = {
  metrics: {
    versions: { python: string; sklearn: string; numpy: string };
    n_activated: number;
    protocol: string;
    assembled: Record<string, Record<string, { precision: number; recall: number; hit_rate: number; violations: number; mean_products: number }>>;
    raw_topk_before_dependency_assembly: Record<string, Record<string, { precision: number }>>;
    paired_bootstrap_assembled_p3: { pop_segment: { delta_p3: number; ci95: number[] } };
    historical_log_reference_not_this_run: { gbm_precision_at_3: number; pop_segment_precision_at_3: number; gbm_precision_at_5: number; warning: string };
    limitations: string[];
    historical_purchase_audit: { lines: number; profile: number; dependency_only: number; union_profile_or_dependency: number; additional_inactive_registry: number };
  };
  funnel: {
    stages: { stage: string; leads: number; share_of_previous: number | null }[];
    mean_days_lead_to_activation: number;
    mean_follow_up_calls: number;
    median_monthly_bundle_inr: number;
    blended_acquisition_cost_per_activation_inr: number;
    mean_recorded_cost_on_activated_inr: number;
    churn_rate: number;
    activation_with_gstin_flag: { activated: number; leads: number; rate: number };
    activation_without_gstin_flag: { activated: number; leads: number; rate: number };
    segments: { segment: string; leads: number; activated: number; activation_rate: number; mean_monthly_bundle_inr: number; revenue_months_to_cover_cac: number | null }[];
  };
};

type Desk = {
  sessions: { id: string; businessName: string; city: string; gstin: string; kyc: { status: string; reasons: string[] }; review: { decision: string } | null; orderId: string; handoffCode: string }[];
  orders: { id: string; status: string; businessName: string }[];
};

const MATRIX = [
  ["Consent ledger before scoring and OCR", "Built", "Stored with purpose, version and case-clock time"],
  ["Gradient-boosting ranker", "Built", "Trained here on the 368 activated leads; out-of-fold metrics"],
  ["Dependency-complete bundles", "Built", "Separate assembler; top 3 and top 5 are not prefixes"],
  ["Quote at catalogue floor", "Built", "Server recomputes price, setup, term and install"],
  ["Tesseract OCR", "Built", "Local binary on the specimen images"],
  ["GSTIN checksum and 90-day bill rule", "Built", "Deterministic"],
  ["GSTIN / Udyam lookup", "Simulated", "Local CSV, not a government API"],
  ["Advisor", "Local generative model, Linux run", "Qwen2.5-1.5B-Instruct Q4_K_M via llama.cpp. Loaded was true. Composer is the fallback only. Mac execution and public deployment were not done."],
  ["Payment and provisioning", "Simulated", "Reference number and milestone buttons only"],
  ["Partner handoff", "Built locally", "A page and a note. No SMS, WhatsApp or CRM"],
  ["Human review", "Built", "Desk key required for the queue and for decisions. Not staff authentication. The key is not shown on this page."],
  ["DPDP compliance", "Not claimed", "The privacy note lists real controls and production gaps"],
];

export function AdminApp() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [desk, setDesk] = useState<Desk | null>(null);
  const [key, setKey] = useState("");
  const [note, setNote] = useState("Reviewed the specimen. Exception recorded for this demo only.");
  const [error, setError] = useState("");

  function remember(value: string) {
    if (value) window.sessionStorage.setItem("udyam-desk-key", value);
  }

  async function loadEvidence() {
    const ev = await fetch("/api/evidence");
    if (ev.ok) setEvidence(await ev.json());
  }

  async function loadQueue(deskKey = key) {
    setError("");
    const response = await fetch("/api/admin", { headers: { "x-demo-desk-key": deskKey } });
    const data = await response.json();
    if (!response.ok) {
      setDesk(null);
      setError(data.error || "Demo desk key required.");
      return;
    }
    remember(deskKey);
    setDesk(data);
  }

  useEffect(() => { void loadEvidence(); }, []);

  async function review(sessionId: string, decision: "approved" | "rejected") {
    setError("");
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-desk-key": key },
      body: JSON.stringify({ action: "review", sessionId, decision, note }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Review failed");
    else { remember(key); await loadQueue(key); }
  }

  const gbm3 = evidence?.metrics.assembled.gbm["3"].precision;
  const hist3 = evidence?.metrics.historical_log_reference_not_this_run.gbm_precision_at_3;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="sim-pill">Evidence desk · metrics are public, the review queue is gated</p>
      <h1 className="font-display mt-3 text-4xl">What this run actually did</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Figures below are from <code>model/artifacts/metrics.json</code> produced by <code>python3 model/train.py</code> on this machine. The historical log is a comparison column, not a substitute for this run.</p>
      {evidence && gbm3 != null && hist3 != null ? (
        <p className="mt-3 text-sm">This run’s assembled Precision@3 is {gbm3.toFixed(4)}. The historical log’s figure is {hist3.toFixed(4)}. Absolute difference {Math.abs(gbm3 - hist3).toExponential(2)}. Python here is {evidence.metrics.versions.python}; the log recorded 3.13.5. scikit-learn {evidence.metrics.versions.sklearn}, numpy {evidence.metrics.versions.numpy}. Their joblib was not in the handoff and was not loaded.</p>
      ) : <p className="mt-3 text-sm">Metrics file is not available.</p>}

      {evidence ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-border"><th className="py-2">Method</th><th>Assembled P@3</th><th>Assembled P@5</th><th>Raw P@5</th><th>Violations</th></tr></thead>
            <tbody>
              {Object.entries(evidence.metrics.assembled).map(([method, block]) => (
                <tr key={method} className="border-b border-border">
                  <td className="py-2">{method}</td>
                  <td>{block["3"].precision.toFixed(4)}</td>
                  <td>{block["5"].precision.toFixed(4)}</td>
                  <td>{evidence.metrics.raw_topk_before_dependency_assembly[method]["5"].precision.toFixed(4)}</td>
                  <td>{block["3"].violations + block["5"].violations}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Paired bootstrap, GBM minus segment popularity, Precision@3 delta {evidence.metrics.paired_bootstrap_assembled_p3.pop_segment.delta_p3.toFixed(4)}, 95% interval {evidence.metrics.paired_bootstrap_assembled_p3.pop_segment.ci95.map((value) => value.toFixed(4)).join(" to ")}. {evidence.metrics.n_activated} activated leads. Purchase audit: {evidence.metrics.historical_purchase_audit.lines} lines, {evidence.metrics.historical_purchase_audit.profile} profile failures, {evidence.metrics.historical_purchase_audit.dependency_only} dependency-only, {evidence.metrics.historical_purchase_audit.additional_inactive_registry} extra inactive-registry lines.</p>
        </div>
      ) : null}

      {evidence ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Observed funnel, Apr–Jun 2026 file</h2>
          <div className="mt-3 space-y-2">
            {evidence.funnel.stages.map((stage) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-sm"><span>{stage.stage}</span><span>{stage.leads.toLocaleString("en-IN")}{stage.share_of_previous ? ` · ${percent(stage.share_of_previous)} of previous` : ""}</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(stage.leads / evidence.funnel.stages[0].leads) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Mean {evidence.funnel.mean_days_lead_to_activation.toFixed(2)} days to activation, {evidence.funnel.mean_follow_up_calls.toFixed(2)} follow-up calls, median bundle {inr(evidence.funnel.median_monthly_bundle_inr)}. Blended acquisition cost {inr(evidence.funnel.blended_acquisition_cost_per_activation_inr)} is all recorded spend divided by 368 activations. The mean cost stored on activated rows alone is {inr(evidence.funnel.mean_recorded_cost_on_activated_inr)}. Six-month churn {percent(evidence.funnel.churn_rate)}. GSTIN flag {evidence.funnel.activation_with_gstin_flag.activated}/{evidence.funnel.activation_with_gstin_flag.leads} versus {evidence.funnel.activation_without_gstin_flag.activated}/{evidence.funnel.activation_without_gstin_flag.leads}. Revenue-months divide activated-row cost by mean monthly bundle. That is not profit payback; contribution margin is not in the file.</p>
          <ul className="mt-3 text-sm">
            {evidence.funnel.segments.map((segment) => (
              <li key={segment.segment}>{segment.segment}: {segment.activated}/{segment.leads} activated ({percent(segment.activation_rate)}), mean bundle {inr(segment.mean_monthly_bundle_inr)}, {segment.revenue_months_to_cover_cac?.toFixed(2)} revenue-months.</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Implementation matrix</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {MATRIX.map(([name, state, detail]) => (
            <li key={name} className="grid gap-1 border-b border-border py-2 sm:grid-cols-[1.4fr_0.6fr_2fr]"><span>{name}</span><Badge variant="outline">{state}</Badge><span className="text-muted-foreground">{detail}</span></li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Review queue</h2>
        <p className="mt-2 text-sm text-muted-foreground">The review queue and every decision need the desk key from the server environment. This page does not display it and does not pre-fill it. If that key is missing, the queue stays closed. It is a local gate, not staff authentication. A key you type is kept in this browser only so a tracker link from this page can send it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="h-11 max-w-xs" value={key} onChange={(event) => setKey(event.target.value)} aria-label="Demo desk key" type="password" autoComplete="off" />
          <Button className="h-11" onClick={() => loadQueue()}>Load review queue</Button>
        </div>
        <Input className="mt-2 h-11 max-w-xl" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Review note" />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <ul className="mt-4 space-y-3">
          {(desk?.sessions || []).map((session) => (
            <li key={session.id} className="rounded-xl border border-border p-3 text-sm">
              <strong>{session.businessName}</strong> · {session.city} · GSTIN {session.gstin || "—"} · KYC {session.kyc.status}
              {session.review ? ` · reviewer ${session.review.decision}` : ""}
              <p className="text-muted-foreground">{session.kyc.reasons.join(" ")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button className="h-10" onClick={() => review(session.id, "approved")}>Approve exception</Button>
                <Button variant="outline" className="h-10" onClick={() => review(session.id, "rejected")}>Reject</Button>
                {session.orderId ? <a className="self-center underline" href={`/track/${session.orderId}`}>{session.orderId}</a> : null}
                <a className="self-center underline" href={`/handoff/${session.handoffCode}`}>Handoff</a>
              </div>
            </li>
          ))}
        </ul>
        <Button variant="destructive" className="mt-4 h-11" onClick={async () => {
          const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json", "x-demo-desk-key": key }, body: JSON.stringify({ action: "wipe" }) });
          if (response.ok) { remember(key); await loadQueue(key); }
        }}>Wipe demo orders</Button>
      </section>
    </main>
  );
}
