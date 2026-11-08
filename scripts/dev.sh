#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x .venv/bin/python ]]; then
  PY="$(pwd)/.venv/bin/python"
else
  PY=python3
fi
if [[ ! -f model/artifacts/ranker.joblib ]]; then
  echo "Missing model/artifacts/ranker.joblib. Run: $PY model/train.py" >&2
  exit 1
fi
"$PY" model/serve.py &
ranker_pid=$!
advisor_pid=""
cleanup() {
  kill "$ranker_pid" 2>/dev/null || true
  if [[ -n "${advisor_pid}" ]]; then kill "$advisor_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
for _ in $(seq 1 50); do
  if curl -sf http://127.0.0.1:43124/health >/dev/null; then
    break
  fi
  sleep 0.2
done
weights="model/artifacts/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf"
if dir="$(bash scripts/advisor-dir.sh)" && [[ -x "$dir/llama-server" && -f "$weights" ]]; then
  (
    cd "$dir"
    ./llama-server \
      -m "$PWD/../../artifacts/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf" \
      --host 127.0.0.1 --port 43125 -c 2048 -t 4 -ngl 0 --parallel 1 --jinja \
      --api-key "${ADVISOR_KEY:-udyam-local-advisor}"
  ) > /tmp/udyam-advisor.log 2>&1 &
  advisor_pid=$!
  echo "Advisor runtime starting from $dir (log /tmp/udyam-advisor.log)"
else
  echo "Generative advisor not started. Replies stay on the grounded composer." >&2
fi
exec npx next dev --turbopack -H 0.0.0.0 -p 43123
