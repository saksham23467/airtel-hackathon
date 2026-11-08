# Privacy and security note

Team 0xAlpha, IIIT Delhi. This describes controls that exist in the demo. It does not claim compliance with the Digital Personal Data Protection Act, 2023, or with telecom KYC rules. A PDF layout of this note is separate from this source file.

The journey collects segment, city tier, size, turnover band, current internet, spend, and optional GSTIN or Udyam numbers. It does not collect a phone number, email, card number, or password. Specimen images are the fictional pack. The screen tells the operator not to upload a real identity document.

Three consents are stored separately: discovery, KYC, and simulated order. Each has purpose, version `udyam-demo-2026-07-15`, and a case-clock time. Scoring and OCR refuse to run without the matching consent. Withdrawal deletes the profile, quote, advisor text and OCR text for that session.

GSTIN and Udyam values are visible on the KYC step because that step is the check. The tracker, the partner handoff and the audit log use a mask. The ranker log records the HTTP status, not the request body. A scan of the development log after the KYC run found no raw GSTIN.

Orders live in `data/runtime/store.json` on the server. The cookie is HTTP-only and holds only a session id. This preview is plain HTTP on a development port.

The GSTIN and Udyam lookups are local CSV files. Payment is a `SIM-` reference. The review desk reads `DEMO_DESK_KEY` from the server environment. Setup can write a random value into gitignored `.env.local`. The app does not print it, and there is no default key: a missing or short value rejects every desk call. The partner page is opened with a long code and shows masked registration numbers, not the contact name or the OCR text.

The screen is English or Hindi. Another preferred language on a lead is stored and is not translated.

Revision, prototype fix pass: anonymous and cross-session reads of the order tracker are refused, and the admin queue is refused without the desk key. `UDYAM_RETENTION_DAYS` (default 14, or `off`) deletes aged session and order rows from the JSON store on the next read, using wall-clock `storedAt`, not the 15 July 2026 case clock. Records without that field are stamped when first opened, not backdated. The sweep does not run while the process is stopped, does not cover backups or model logs, and does not encrypt the file. Raw identifiers stay plaintext until purge or withdrawal.

Not built, and not to be described as built: encryption at rest, staff authentication, a retention schedule reconciled with KYC law, real registry or payment integrations, and a lawful-basis memo a regulator could rely on. The demo purge is not that legal schedule.
