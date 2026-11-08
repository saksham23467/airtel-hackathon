# Revision note — advisor, access, Hindi

Private draft fix pass. This is not a new product and not a scored rubric. Team name, demo video, and repository visibility are still unset. The review deck and the original privacy PDF were not edited.

## What changed

The advisor no longer trusts a small model to invent catalogue facts. `lib/advisor.ts` writes a deterministic reply from catalogue description, floor price, setup, contract, install days, eligibility, and the saved quote. Stated needs change that reply: internet-only stays on eligible standalone broadband, a saved non-connectivity line is named only to say it should be removed, a vague “help” asks three questions and does not replace the business form, and a new budget is compared as a typed number. The screen labels this path as a deterministic fallback.

When llama.cpp is reachable, `lib/generative.ts` asks the model only to paraphrase that draft. The paraphrase is shown as generated only if it keeps the draft’s rupees, install days, unlimited-data wording, and product fit. “Rs 100” from “100 Mbps” is not an allowed price. “Fits your budget” without a saved quote at or below the typed figure is rejected. Prompt injection is not sent to the model. A short Hindi reply is kept when it is real Hindi and the claims still check out.

`GET /api/admin` requires the desk key and no longer returns a key hint. The review page does not pre-fill the key. Order reads and milestone posts require the owning session cookie or the desk key, and the milestone check happens before the “nothing left to advance” error. `UDYAM_RETENTION_DAYS` (default 14) deletes aged JSON rows and upload files on the next store read. The file is still plaintext. That purge is not encryption and not a statutory KYC schedule. See `docs/PRIVACY_NOTE.md`.

OCR now uses `.venv/bin/python` when the project virtualenv exists.

## What was not changed

KYC outcomes were not loosened. GSTIN checksum still accepts a valid number whose embedded PAN has fourth character X (`27XUIXG0767D1ZP`). Udyam district `00` is still accepted. Bill age still uses 15 July 2026. Specimen images, registries, ranker artifact, and the review PPTX/PDF were left as shipped. No payment, provisioning, or government call was added. Hindi KYC chip sentences are still English. Languages other than English and Hindi are still not translated.

## How to run

```bash
bash scripts/setup.sh
npm test
npm run dev
```

App port 43123, ranker 43124, advisor 43125. Optional: `DEMO_DESK_KEY`, `UDYAM_RETENTION_DAYS`, `UDYAM_STORE`.

`node scripts/api-recheck.mjs` repeats the quote, advisor, OCR, checkout, and cross-session checks against a running server.

## What this VM measured

Not a rubric score. Mocks, unit tests, the live local model, and the live API are separate.

- `npx tsc --noEmit` passed. `npx eslint app components lib tests scripts --max-warnings 0` passed. `npx next build` passed (Next.js 15.5.29).
- Vitest 29/29 (`tests/logic.test.ts` 16, `tests/advisor-security.test.ts` 13). Pytest 10/10. Tesseract 5.3.4. Node v22.23.4. Python 3.12.3 in `.venv`.
- Live `GET /api/advisor/status`: `loaded: true`, Qwen2.5-1.5B-Instruct Q4_K_M, llama.cpp b12189, CPU. Weight SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`.
- Live Star Electronics quote P01+P19+P23+P07: ₹2,096 a month, ₹4,300 setup, 5 days, planning date 2026-07-20.
- Live model, first pass, before unfinished sentences were rejected: “help” was generated in 4548 ms and asked what the need was, including internet versus billing, phones or cameras, and said it would not recommend Cloud POS. “Installation will take too long” was generated in 14667 ms and the opening said Biz Fibre 100, 5 days, planning date 20 July 2026, not a field appointment, but the text was cut off. Hindi “मुझे बस इंटरनेट चाहिए” was generated in 15690 ms, in Hindi, with Biz Fibre 100 and ₹999, and was also cut off. “I only need internet” fell back in 13563 ms because the model’s unlimited-data sentence was not tied to a product. “This is too expensive” fell back in 14494 ms because the model wrote a rupee amount of 5. “my budget is now 1000” fell back in 2846 ms because the model named no product; the composer says the saved ₹2,096 is above the ₹1,000 in the message. Injection was not sent to the model (233 ms) and did not echo a key.
- After that, unfinished model text is discarded. A later live install call fell back in 21736 ms with reason `generation truncated`. A later Hindi internet call fell back in 12888 ms with the same reason. The Hindi composer that replaced it has 933 Devanagari characters, states unlimited data only for Biz Fibre 100, floor ₹999, install 5 days, planning date 2026-07-20, and compares that floor with the typed ₹1,800.
- Live K12 OCR all passed: GST checksum and active mock status, Udyam `UDYAM-AP-00-5186772` with district 00 accepted, bill date 2026-07-06 is 9 days before 15 July 2026, signatory passed. Quote PDF started with `%PDF`. Checkout created `AB-07F598F7`. Anonymous and other-session order reads returned 403. Owner read returned 200. Anonymous milestone post returned 403. Owner advanced to `survey_booked`. Desk key advanced to `install_slot`. Anonymous admin returned 403 and did not contain the key. Desk admin returned 200.
- The first copy of `scripts/api-recheck.mjs` looked for `session.kyc` while the route returns `documents`, so it reported OCR failures even though every evaluation outcome was `passed`. The script now reads `documents`. That was a harness bug, not a KYC change.
