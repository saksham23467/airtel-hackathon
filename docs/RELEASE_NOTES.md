# Release notes — 0xAlpha, IIIT Delhi

Udyam Digital prototype for the fictional operator Accel Business. This is not a judge score and not a claim of selection.

Private source: https://cursor.com/codebase/saksham-bansal/udyam-digital

That URL does not by itself admit a judge. Someone has to grant access. The repo stays private. Nothing here is deployed publicly.

The final slide deck is not in this source drop.

## Artifact repair

No runtime change. The code-tested commit remains `2f63212a77fac21a6e1a081b1e16fa8de2f483fb`, with 31 Vitest and 10 pytest tests passing (41). `docs/architecture.svg` had a U+0014 control byte and did not parse as XML. It is replaced by the same diagram with an em dash, and `docs/architecture.png` is a 1840×1280 render of that SVG. `review-package/` is removed. The app does not read that folder. It was an older review bundle with a team-name placeholder and older metrics. The original uploaded submission is unchanged and is not in this repository.

## What the prototype does

A browser session takes discovery consent, scores the supplied catalogue, prices a quote at catalogue floors, asks a local model to paraphrase a short catalogue draft, reads specimen images with Tesseract, checks checksums and the local mock GSTIN and Udyam files, and writes a simulated order. The tracker and the partner page say the timeline is simulated and that no money and no message were sent.

English and Hindi are the only interface languages. Any other preferred language on a lead is stored and shown as a label.

The review desk has no default key. `scripts/setup.sh` writes a random `DEMO_DESK_KEY` into gitignored `.env.local` when that line is absent. The app never prints it. A missing or short value rejects every desk call. Order reads and milestone posts require the owning session cookie or that key.

The partner page is a field-partner simulation route opened by a 128-bit code. It shows city, size, masked GSTIN, masked Udyam, quote lines, KYC status, and order status. It does not show the contact name, the advisor transcript, or OCR text.

Retention is `UDYAM_RETENTION_DAYS`, default 14, swept on the next store read using wall-clock `storedAt`. The JSON file is plaintext. The sweep is not encryption and not a statutory KYC schedule.

## Reproduced on this Linux VM

Final regression, 7 November 2026, on the source after the team name and handoff-route copy. Node v22.23.4, Python 3.12.3, Tesseract 5.3.4. Mac was not executed.

One lint failure had to be fixed before this green run: `scripts/kyc-packs.mjs` assigned `pack` and never used it, and `eslint --max-warnings 0` stopped. That assignment was removed. No feature change. The green tree is commit `2f63212a77fac21a6e1a081b1e16fa8de2f483fb`. This notes file is committed on top of that tree. The source zip is the commit that contains this paragraph.

Exact green commands on that tree:

- `npx tsc --noEmit` passed.
- `npx eslint app components lib tests scripts --max-warnings 0` passed.
- `npx next build` passed, Next.js 15.5.29. The build loaded `.env.local` for the local server only. That file is gitignored and is not in the source zip.
- `npx vitest run`: 31 passed (16 in `tests/logic.test.ts`, 15 in `tests/advisor-security.test.ts`).
- `bash scripts/pytest.sh`: 10 passed.

The Hindi free-text box in the browser still does not submit reliably. Objection buttons do. That limitation is unchanged and was not reworked in this verification.
- Live advisor with Qwen2.5-1.5B-Instruct Q4_K_M loaded: several replies were generated in about 4–5 seconds, including “Installation will take too long” (Biz Fibre 100, 5 days, 20 July 2026, not a field appointment) and a browser reply labelled “Generated locally · Qwen2.5-1.5B-Instruct · 4703 ms”. “I only need internet” fell back in 5278 ms because the model pushed Cloud POS; the labelled composer keeps fibre, states unlimited data only for Biz Fibre 100, and says the saved POS line is not recommended. A generated budget sentence that called the ₹4,300 setup figure a monthly total was rejected by the claim check. Injection was not sent to the model.
- Live quote for Star Electronics lines P01, P19, P23, and P07: ₹2,096 a month, ₹4,300 setup, 5 days, planning date 2026-07-20. After the browser removed a line, the tracker showed ₹1,598 a month.
- Live OCR, persona packs: K12 all passed; K11 address failed and the other three passed; K01 GST and Udyam failed; K03 all passed; K07 GST manual review; K06 GST checksum failed; K04 and K02 GST manual review. K08 and K09, with the business name taken from the GST OCR field rather than a persona card, passed all four. K10 GST checksum failed. K05 has no Udyam image in the pack; GST was manual review (no token), address and signatory passed, so the pack stays incomplete.
- Anonymous admin returned 403. Anonymous and cross-session order reads returned 403. Owner read and owner milestone succeeded. A desk call with the environment key succeeded and the key was not in the anonymous body. Discovery consent blocked scoring with “Discovery consent is required.”
- Browser, desktop 1280 and mobile 390, from the earlier capture that was not repeated in this verification: home, consent, quote edit, advisor label, KYC pass, Hindi Trinity KYC failure (bill 257 days before 15 July 2026), simulated tracker, masked handoff, empty desk-key field, privacy note. Mobile home overflow was 0 pixels. The free-text Hindi ask in the browser did not submit reliably; Hindi is shown by the Trinity interface and by the API composer. This verification did not open another browser and did not re-record.

Screen recording of that walk: 62.6 seconds. It is a capture of the browser, not an animation.

## Criterion map

No points are awarded here.

| Weight | Area | Evidence | Gap that remains |
| --- | --- | --- | --- |
| 16 | Advisor | Catalogue draft, claim checks, labelled generated reply at 4703 ms, internet-only fallback that refuses POS | The 1.5B model still misses some paraphrases. Discovery is a few questions in one reply, then the form. It is not a long interview. |
| 10 | Quote | Server recomputes floors; live 2096/4300; browser edit to 1598; dependency and tier rules in Vitest | Illustrative 18% is not a tax invoice. |
| 16 | KYC | Twelve packs exercised. Failures and reviews stayed failures and reviews. District 00 and PAN fourth character X stay accepted when the checksum is valid. | K05 has no Udyam specimen file. KYC chip text is Hindi for the common sentences; some OCR labels stay English. |
| 6 | Tracker | Simulated milestones, SIM reference, planning date called out as not a field appointment | No real field force. |
| 6 | Engineering | Typecheck, lint, production build, 31 Vitest, 10 pytest, fail-closed desk key | Mac llama.cpp was not run. |
| 6 | Mobile and language | 390px shot, overflow 0, Hindi Trinity KYC | Only English and Hindi. Other lead languages are stored only. |
| 10 | Segment | Ranker and segment badges are in the running app | Who to serve first is a deck argument, not a new model in this pass. |
| 8 | Funnel | Evidence desk shows the Apr–Jun 2026 file, 5000 to 368 | Not a new commercial forecast. |
| 6 | Partners | Field-partner route, masked GSTIN and Udyam, no SMS | One simulated route, not a CRM. |
| 6 | Metrics | This run’s assembled Precision@3 is 0.7074 on the evidence desk | Historical comparison only. No new training run in this pass. |
| 6 | Business case | Not rewritten here | The deck is separate. |
| 4 | Privacy | Consent gates, masks, 14-day read-triggered purge, plaintext stated, no default desk key | No encryption at rest and no statutory retention schedule. |

## Reproduce

```bash
bash scripts/setup.sh
npm test
npm run dev
```

Open `http://127.0.0.1:43123` on that same computer. `node scripts/api-recheck.mjs` and `node scripts/kyc-packs.mjs` need the server and a `DEMO_DESK_KEY` of at least 16 characters in the environment. The scripts do not print the key.

## Not verified

Mac execution. Judge access to the private repo. The final slide deck. A public URL. Encryption. Staff accounts.
