# Test results

Two stages, both on 7 November 2026. The first stage is the initial build, when the advisor was only the grounded composer. The second stage is the current Linux run, after Qwen2.5-1.5B-Instruct was loaded. Do not quote the first stage as the current advisor.

## Automated, initial build

`npx vitest run` — 14 tests passed, including:

- GSTIN checksum and the OCR repairs for K07, K01 and K11; K06 is not rewritten to another registry row
- Assembler inserts a base and does not treat a 1-slot bundle as a prefix of the 3-slot bundle
- SD-WAN at 8 sites: monthly ₹20,000 and setup ₹40,000 from catalogue fields `2500` and `5000`
- Guest Wi-Fi alone is an invalid quote
- A cancelled GSTIN blocks a GST-required product
- Bill dated 2025-10-31 fails; 2026-07-06 passes
- “Shri Physio Clinic” does not match “Neelgiri Physio Clinic”
- Log redaction masks GSTIN, Udyam and SYN-ID
- An order written to the server store is still there on the next read
- Live Tesseract on `K12_gst_certificate.png` returns Star Electronics and `37NBLXS1145E1ZU`
- Live Tesseract on `K11_address_proof.png` returns `2025-10-31`
- Live Tesseract on the blurred `K04_gst_certificate.png` does not produce a passing GST decision

`python3 -m pytest -q model/test_recommender.py` — 10 tests passed, including the 40/9/49/9 purchase audit, the funnel counts 5000/3406/1974/861/588/368, blended CAC ₹15,053.37, and this run’s Precision@3 of 0.707427536231884 with zero assembled violations.

## API walk

Against the running app:

- Star Electronics, all four specimens: GST, Udyam, address and signatory each `passed`. Checkout created `AB-…`. A simulated milestone was still present on a second GET. Quote PDF returned `%PDF-1.7`. Handoff showed `37••••••1ZU` and not the raw number.
- Trinity Bake House: address `failed`, other three `passed`, overall `failed`.
- Vindhya Tours: GST `failed` (cancelled), Udyam `failed` (blank number).
- Neelgiri Physio: GST `manual_review` (legal name).
- Saffron Dental: GST `manual_review` (blurred scan).

## Browser, initial build

Playwright (Chromium) clicked the home page, consent, scoring, the composer-only advisor, quote, fibre removal, Star Electronics OCR, Trinity bill OCR, the evidence desk, architecture and the privacy note. Mobile width 390 did not overflow the home page, the quote, or the evidence desk. Those shots are `01` through `17` in the evidence zip. `06-advisor.png` is the composer screen from this stage. It is not the current advisor.

`npx tsc --noEmit` passed. `npx eslint app components lib tests --max-warnings 0` passed before the last KYC status tweak.

## Generative advisor, current Linux run

This replaced the “no model loaded” statement from the initial build.

`GET /api/advisor/status` returned `loaded: true` for Qwen2.5-1.5B-Instruct Q4_K_M on llama.cpp b12189, CPU. Four Star Electronics questions were generated in 4071 ms, 2177 ms, 3161 ms and 797 ms. Each accepted reply named a supplied product id. A sample that wrote “Rs 100” for a megabit figure was discarded, and the composer was returned with that reason. That composer text is a fallback, not the normal loaded path. Details are in `docs/ADVISOR_RUNTIME.md`. Screenshot `18-advisor-generated.png` shows a later accepted reply labelled “Generated locally” with a millisecond time.

Vitest is now 16 tests. Pytest remains 10. Together that is 26, after the two grounding tests were added to the earlier 24.

## Not verified

- No public HTTPS deployment. The build machine’s address is not a demo URL. See `docs/DEPLOYMENT.md`.
- The macOS llama.cpp binaries were identified as Mach-O and were not executed. Mac Gatekeeper behaviour was not tested.
- Generation quality beyond the four timed Linux questions was not scored with a separate human rubric.
- The historical ranker log’s Python was 3.13.5; this machine is 3.12.3. Ranker precision matched. That is not a claim that every unpublished intermediate of the missing v3 ranker script matched. The phrase “not a loaded artifact” in `docs/EVALUATION.md` refers to that missing ranker joblib, not to the advisor model.
