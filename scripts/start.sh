#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x .venv/bin/python ]]; then
  PY="$(pwd)/.venv/bin/python"
else
  PY=python3
fi
"$PY" model/serve.py &
ranker_pid=$!
advisor_pid=""
cleanup() {
  kill "$ranker_pid" 2>/dev/null || true
  if [[ -n "${advisor_pid}" ]]; then kill "$advisor_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
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
fi
exec npx next start -H 0.0.0.0 -p 43123
