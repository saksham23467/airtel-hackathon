#!/usr/bin/env bash
# Print the bundled llama-server directory for this OS, or exit 1.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) echo "$root/model/bin/llama-b12189" ;;
  Darwin-arm64) echo "$root/model/bin/macos-arm64" ;;
  Darwin-x86_64) echo "$root/model/bin/macos-x64" ;;
  *)
    echo "No bundled llama-server for $(uname -s) $(uname -m). The advisor will use the grounded composer." >&2
    exit 1
    ;;
esac
