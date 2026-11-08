export const metadata = { title: "Privacy note · Udyam Digital" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-sm leading-6">
      <p className="sim-pill">Prototype note · 15 July 2026 case clock</p>
      <h1 className="font-display mt-3 text-4xl">Privacy and security choices</h1>
      <p className="mt-4">This note describes controls that exist in this demo. It is not a claim that the build complies with the Digital Personal Data Protection Act, 2023, telecom KYC rules, or any sector direction. Counsel would still have to confirm lawful basis, retention and processor terms before a production deployment.</p>
      <p className="mt-3">Team 0xAlpha, IIIT Delhi. Revision: the review queue and order tracker refuse anonymous and cross-session reads. A configurable wall-clock retention window can delete aged session and order records from the local JSON file. The file is still plaintext. This is not encryption, and it is not a retention schedule reconciled with telecom KYC law. The one-page source for a PDF is <code>docs/PRIVACY_NOTE.md</code>. This page is not a filed privacy notice.</p>
      <h2 className="font-display mt-6 text-2xl">What is collected</h2>
      <p className="mt-2">The journey asks for business context the catalogue rules actually use: segment, city tier, employees, sites, turnover band, current internet, spend, and optional GSTIN or Udyam numbers. It does not ask for a phone number, email address, card number, password or a live photograph. Specimen images are the supplied fictional pack, or a file the operator uploads during a demo. The screen says not to upload a real identity document.</p>
      <h2 className="font-display mt-6 text-2xl">Consent</h2>
      <p className="mt-2">Three separate consents are stored: discovery and quoting, KYC extraction and mock lookup, and simulated order. Each record has a purpose, the notice version <code>udyam-demo-2026-07-15</code>, and a case-clock time. Scoring and the advisor refuse to run without discovery consent. OCR and registry checks refuse to run without KYC consent. Checkout refuses without all three, plus an on-screen acknowledgement that no money moves. Withdrawal deletes the profile, the quote, advisor text and OCR text for that session.</p>
      <h2 className="font-display mt-6 text-2xl">Identifiers</h2>
      <p className="mt-2">GSTIN and Udyam values are shown on the KYC step because that step is the check. The tracker, partner handoff and server audit log store or print a mask. The redaction helper also scrubs those patterns and <code>SYN-ID</code> numbers if they reach a log line. The model server does not put the GSTIN in the URL. Its log line is the HTTP status only.</p>
      <h2 className="font-display mt-6 text-2xl">Where data sits</h2>
      <p className="mt-2">Quotes, orders, consent and OCR text are in a JSON file on this machine, <code>data/runtime/store.json</code>, which is gitignored. Uploads sit beside it. The session cookie is HTTP-only. There is no browser-only copy of the order. Refreshing the tracker reads the server. This preview is plain HTTP on a development port. That is acceptable for a local demo and is not a production transport design.</p>
      <h2 className="font-display mt-6 text-2xl">What is simulated</h2>
      <p className="mt-2">GSTIN and Udyam “lookups” read the supplied CSV files. Checksum, date and name checks are local rules. A blurred or skewed scan stays in manual review; the app does not paste in an answer key. Payment is a <code>SIM-</code> reference. Milestones are buttons. The handoff is a page opened with a long code. It shows masked registration numbers, not the contact name or the OCR text. The review desk reads a server key that this page does not print. There is no default key. The interface is English or Hindi. Another preferred language is stored and is not translated.</p>
      <h2 className="font-display mt-6 text-2xl">Production work that is not done</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Encryption at rest, key management, and tested backup.</li>
        <li>Authenticated staff roles, access reviews, and an incident process.</li>
        <li>A retention schedule reconciled with telecom KYC law. The demo window below is a local purge, not that schedule.</li>
        <li>Real registry, e-sign, payment and provisioning integrations, with contracts.</li>
        <li>A lawful-basis assessment, grievance path and processor list a regulator could read.</li>
      </ul>
      <h2 className="font-display mt-6 text-2xl">Demo retention</h2>
      <p className="mt-2">Sessions and orders carry a wall-clock <code>storedAt</code>. On each store read, records older than <code>UDYAM_RETENTION_DAYS</code> (default 14, <code>off</code> disables the sweep) are removed, including upload files whose paths sit under the upload directory. Records that predate the field are stamped on first open and are not backdated. The sweep does not run while the process is stopped, does not cover backups or model logs, and does not encrypt the JSON. The case clock stays 15 July 2026 and is not the retention clock. Raw identifiers remain plaintext until a purge or a withdrawal.</p>
    </main>
  );
}
