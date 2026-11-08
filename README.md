# Udyam Digital

Onboarding prototype for **Accel Business**, the fictional operator in the YTL Airtel Sync 2026 Track A case. Team 0xAlpha, IIIT Delhi.

Private source: https://cursor.com/codebase/saksham-bansal/udyam-digital

That link does not by itself let a judge in. Access has to be granted separately. The repository stays private. There is no public deployment.

This zip is the source. It does not contain the language-model weights or the llama.cpp binaries. `bash scripts/setup.sh` downloads those from their public URLs and checks the SHA-256 values in `THIRD_PARTY_NOTICES.md`.

## Setup

Tested on Linux x86_64 with **Node v22.23.4** and **Python 3.12.3**. Mac steps are in `docs/MAC.md`. The Mac llama.cpp binaries were not executed on the Linux build machine.

You need Node 22, Python 3.12, and Tesseract. On a Mac, Homebrew paths are `/opt/homebrew` (Apple silicon) or `/usr/local` (Intel):

```bash
brew install node@22 python@3.12 tesseract
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"   # Intel: /usr/local/opt/node@22/bin
```

On Debian or Ubuntu the tested path is Node v22.23.4, Python 3.12.3, and Tesseract 5.3.4. `python3.12 -m venv .venv` was run on that machine after installing the venv package. Install it, then run the same setup script:

```bash
sudo apt-get install tesseract-ocr python3.12-venv
bash scripts/setup.sh
```

From the unpacked source:

```bash
bash scripts/setup.sh
npm run dev
```

`setup.sh` creates `.venv` with `python3.12 -m venv` (it does not use an externally managed system pip), installs `model/requirements.txt` into that venv, runs `npm install`, then downloads:

- Qwen2.5-1.5B-Instruct Q4_K_M from Hugging Face
- llama.cpp build b12189 for this operating system from GitHub

Both downloads are refused if the SHA-256 does not match. On a Mac the script does not remove the quarantine flag and does not turn Gatekeeper off. If macOS blocks `llama-server`, use System Settings → Privacy & Security → Open Anyway. Details are in `docs/MAC.md`.

Then, on the **same computer**, open `http://127.0.0.1:43123`.

`npm run dev` starts the site on port 43123, the catalogue ranker on port 43124, and the advisor on port 43125 when the weights and binary are present. Ranker code uses `.venv/bin/python` when that file exists.

```bash
npm test
```

## Advisor

Qwen2.5-1.5B-Instruct is Apache-2.0. llama.cpp is MIT. See `THIRD_PARTY_NOTICES.md`. The deterministic composer builds the reply from catalogue rows, eligibility, and the saved quote. When `llama-server` is reachable, the model is asked only to paraphrase that draft. The reply is labelled generated only if that paraphrase stays inside the draft: rupee amounts, install days, unlimited-data wording, budget comparisons, and products that match the stated need. A megabit number is not an allowed price. Anything else is shown as a deterministic fallback, with the reason. Prompt-injection text is not sent to the model.

## Desk key and retention

`/api/admin` and order milestone changes require `DEMO_DESK_KEY`. The order tracker also accepts the owning session cookie. `bash scripts/setup.sh` writes a random key into `.env.local` when that line is absent. The file is mode 600 and gitignored. The running app does not display the key. If the variable is missing or shorter than 16 characters, every desk request is refused. There is no built-in default.

The partner handoff opens with a 128-bit code. That page shows the business, city, size, masked GSTIN and Udyam, the quote totals, KYC status, and order status. It does not show the contact name, the advisor transcript, or OCR text.

Interface copy is English and Hindi. A lead’s preferred language is stored and is not translated when it is neither of those two.

`UDYAM_RETENTION_DAYS` defaults to 14. `off` disables the sweep. Aged sessions, orders, and upload files under the upload directory are removed on the next store read. The store is still plaintext JSON. See `docs/PRIVACY_NOTE.md`. OCR uses `.venv/bin/python` when that file exists.

## What the case data does

Catalogue prices, dependencies, and install days come from `data/product_catalogue.csv`. The saved ranker in `model/artifacts/ranker.joblib` was trained here: out-of-fold Precision@3 is 0.7074 versus 0.6839 for segment popularity. OCR uses the local Tesseract binary on the specimen images in `data/kyc_documents/`. GSTIN and Udyam lookups read the CSV registries. No payment, provisioning, or government API is called. The official case PDF is not in this zip.
