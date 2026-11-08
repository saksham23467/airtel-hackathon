# Feature matrix

The initial build had no generative model. The advisor row below is the current Linux run, where `loaded` was true. Mac execution of llama.cpp and a public deployment are still open.

| Capability | State | Evidence |
| --- | --- | --- |
| Discovery, KYC and order consent, stored before the matching action | Built | `app/api/session/route.ts` refuses scoring and OCR without the matching consent |
| Business context, with size defaults marked as defaults | Built | Persona cards and the business step |
| Gradient-boosting ranker | Built | `model/train.py`, `model/artifacts/metrics.json` |
| Segment-popularity fallback if the ranker process is down | Built | `lib/recommend.ts`, labelled in the UI |
| Dependency-complete 3- and 5-slot bundles, assembled separately | Built | `lib/assemble.ts`, screenshot `09-quote-dependency.png` |
| Quote at catalogue `price_min`, setup times quantity, longest minimum contract, slowest install | Built | `lib/quote.ts`, Vitest, PDF download |
| Illustrative 18% line | Labelled assumption | Shown as not a tax invoice |
| Tesseract OCR | Built | `model/ocr.py`, Vitest on K12, K11, K04 |
| GSTIN checksum, including a disclosed one-character repair | Built | `lib/gstin.ts` |
| Mock GSTIN and Udyam lookup | Simulated local file | CSV registries, not a government API |
| 90-day address rule at 15 July 2026 | Built | K11 fails at 257 days |
| Manual review versus hard fail | Built | K07 and K04 review; K01 and K11 fail |
| Human exception | Built | Evidence desk. The queue and decisions require the server desk key. The key is not returned by the API and is not pre-filled in the page. Not staff login |
| Advisor | Local generative model, with a deterministic fallback | Qwen2.5-1.5B-Instruct Q4_K_M via llama.cpp on CPU when the process is up. A reply is labelled generated only when the model wrote it and catalogue claim checks accept it. Otherwise the composer is labelled as not generative |
| Simulated checkout and persistent timeline | Built | Server JSON store; refresh keeps the milestone |
| Partner handoff | Built locally | Page plus a note. No SMS, WhatsApp, or CRM |
| Masked identifiers in logs, tracker and handoff | Built | `lib/redact.ts`; server log check found no raw GSTIN |
| English and Hindi interface | Built | Step chrome, advisor, quote, tracker, handoff labels, and the common KYC result sentences. Any other preferred language is stored as a label and is not translated |
| DPDP compliance | Not claimed | `docs/PRIVACY_NOTE.md` |
| Live payment, provisioning, e-sign, DigiLocker | Not built | Stated on the simulation pill |
