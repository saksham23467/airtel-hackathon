# Architecture

```text
Browser
  |  cookie udyam_sid, no catalogue prices trusted
  v
Next.js  :43123
  |-- consent ledger, quote maths, KYC decision, PDF, orders, handoff
  |-- Tesseract via model/ocr.py
  |-- data/*.csv  (catalogue, leads, mock GSTIN, mock Udyam)
  |-- data/runtime/store.json  (gitignored)
  v
Python ranker  :43124
  |-- HistGradientBoostingClassifier in model/artifacts/ranker.joblib
  |-- returns scores only for eligible products
  v
Assembler (same rules in Python and TypeScript)
  |-- inserts a required base inside the 3-slot or 5-slot budget

Advisor, current Linux run  :43125
  |-- llama.cpp llama-server b12189, CPU
  |-- Qwen2.5-1.5B-Instruct Q4_K_M, downloaded by scripts/setup.sh
  |-- paraphrases a catalogue draft; claim checks can fall back to the composer
```

The ranker does not close dependencies. The assembler does not assign the score. The quote route ignores any price sent by the browser and multiplies `price_min` and `one_time_setup_inr` by quantity.

OCR text is produced before checksum, registry status, the 90-day rule, and human review. Each of those is a separate chip. A blurred image stays in review. The manual transcription JSON from the case pack is not used as the OCR result.

The first build of this prototype had no generative model. A later Linux run recorded `loaded: true`. The composer is the reply when the local process is down, when the owner message is a prompt injection, or when a generated sentence fails the catalogue claim checks. A megabit figure is not treated as a rupee price. No request calls a paid model API, a payment gateway, a messaging API, or a government endpoint. The Mac binaries for llama.cpp were not executed here, and there is no public deployment.
