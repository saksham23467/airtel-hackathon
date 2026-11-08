export const metadata = { title: "Architecture · Udyam Digital" };

const boxes = [
  ["Browser", "Consent, context, quote edits, specimen choice"],
  ["Next.js routes", "Session, quote maths, KYC decision, PDF, tracker"],
  ["Python ranker", "HistGradientBoosting on eligible products"],
  ["Assembler", "Dependency-complete 3- and 5-slot bundles"],
  ["Tesseract", "OCR text only. Rules run after the text"],
  ["CSV files", "Catalogue, leads, mock GSTIN, mock Udyam"],
  ["JSON store", "Orders, consent, masked audit"],
];

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-4xl">Architecture</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">One Next.js process on port 43123 and one local Python process on port 43124. Nothing in the request path calls a paid model, a government API, a payment gateway or a messaging provider.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {boxes.map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </article>
        ))}
      </div>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
        <li>The browser sends a profile only after discovery consent. The GSTIN is used for the active-status check and is not written to the model log.</li>
        <li>The ranker returns scores for eligible products. Eligibility is city tier, employees, sites, and an active mock GSTIN when the catalogue requires one.</li>
        <li>The assembler then inserts a required base inside the slot budget. A dependency insert is labelled separately from a model pick.</li>
        <li>The quote route ignores client prices and multiplies catalogue floors by quantity.</li>
        <li>OCR runs only after KYC consent. Checksum, mock-registry status, date rules and human review are separate chips.</li>
        <li>Checkout writes an order. The tracker reads it only for that demo session, or for a reviewer who sends the desk key. The handoff page is still opened with its code.</li>
      </ol>
      <p className="mt-6 text-sm">The advisor calls the local Qwen process only when that process is reachable, and only with a catalogue draft. A reply is labelled generated when the model wrote it and the claim checks accept it. Otherwise the screen shows the deterministic composer and the reason. A price that is merely some integer in the fact text, such as a megabit figure, is not treated as a rupee amount. An earlier Linux run recorded the model as loaded. This page does not by itself prove the model is loaded on the machine you are using. Mac binaries were not executed here, and this site is not publicly deployed.</p>
    </main>
  );
}
