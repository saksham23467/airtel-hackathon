#!/usr/bin/env bash
# Install interpreters' packages and download the pinned advisor assets.
# Does not change macOS Gatekeeper or the quarantine attribute.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(pwd)"

echo "Udyam Digital setup"
echo "Directory: $root"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 is required. Tested version: v22.23.4." >&2
  echo "Mac: brew install node@22" >&2
  echo "Then put it on PATH. Apple silicon: export PATH=\"/opt/homebrew/opt/node@22/bin:\$PATH\"" >&2
  echo "Intel Mac: export PATH=\"/usr/local/opt/node@22/bin:\$PATH\"" >&2
  exit 1
fi
node_version="$(node -v)"
echo "node $node_version"
case "$node_version" in
  v22.*) ;;
  *)
    echo "This project was tested with Node v22.23.4. Found $node_version." >&2
    echo "Install Node 22 and run this script again. Mac: brew install node@22" >&2
    exit 1
    ;;
esac

if command -v python3.12 >/dev/null 2>&1; then
  py=python3.12
else
  py=python3
fi
if ! command -v "$py" >/dev/null 2>&1; then
  echo "Python 3.12 is required. Mac: brew install python@3.12" >&2
  exit 1
fi
py_version="$("$py" -c 'import sys; print("%d.%d.%d"%sys.version_info[:3])')"
echo "python $py_version ($py)"
case "$py_version" in
  3.12.*) ;;
  *)
    echo "Python 3.12 is required so the ranker matches the tested environment. Found $py_version." >&2
    echo "Mac: brew install python@3.12" >&2
    echo "The script uses python3.12 -m venv, not the system pip." >&2
    exit 1
    ;;
esac

if ! command -v tesseract >/dev/null 2>&1; then
  echo "Tesseract is not on PATH. KYC OCR will fail until it is installed." >&2
  echo "Mac: brew install tesseract" >&2
  echo "Debian/Ubuntu: sudo apt-get install tesseract-ocr" >&2
else
  echo "tesseract $(tesseract --version | awk 'NR==1{print $2}')"
fi

echo "Creating .venv with $py"
rm -rf .venv
if ! "$py" -m venv .venv; then
  echo "Could not create a virtual environment." >&2
  echo "Debian/Ubuntu also needs the venv package: sudo apt-get install python3.12-venv" >&2
  echo "Mac Homebrew Python 3.12 includes it. Use: brew install python@3.12" >&2
  exit 1
fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r model/requirements.txt

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required and ships with Node 22." >&2
  exit 1
fi
npm install

os="$(uname -s)-$(uname -m)"
case "$os" in
  Linux-x86_64)
    runtime_url="https://github.com/ggml-org/llama.cpp/releases/download/b12189/llama-b12189-bin-ubuntu-x64.tar.gz"
    runtime_sha="c446a7ba4df3c3b1cc880a734fbff586d6d34b9cebc09e151754813b94ded8c9"
    runtime_dir="model/bin/llama-b12189"
    runtime_note="Linux x86_64 binary. This path was executed on the build machine."
    ;;
  Darwin-arm64)
    runtime_url="https://github.com/ggml-org/llama.cpp/releases/download/b12189/llama-b12189-bin-macos-arm64.tar.gz"
    runtime_sha="f30e2f3032df30a0c37c9fbd43125253dcd4cb96d6a879aa81e464944bc20aee"
    runtime_dir="model/bin/macos-arm64"
    runtime_note="macOS Apple silicon binary. It was not executed on the Linux build machine."
    ;;
  Darwin-x86_64)
    runtime_url="https://github.com/ggml-org/llama.cpp/releases/download/b12189/llama-b12189-bin-macos-x64.tar.gz"
    runtime_sha="c690cb11be36a910df7e3d5baf22ed2fb53c02243c72cd33aae8f5fd6c6afe55"
    runtime_dir="model/bin/macos-x64"
    runtime_note="macOS Intel binary. It was not executed on the Linux build machine."
    ;;
  *)
    echo "No llama.cpp build is pinned for $os. The site still runs; the advisor stays on the grounded composer." >&2
    runtime_url=""
    ;;
esac

fetch() {
  local url="$1" dest="$2" sha="$3"
  if [[ -f "$dest" && -s "$dest" ]]; then
    local have
    have="$(sha256sum "$dest" | awk '{print $1}')"
    if [[ "$have" == "$sha" ]]; then
      echo "Already present and hash matches: $dest"
      return 0
    fi
    echo "Replacing $dest because its sha256 does not match." >&2
  fi
  local tmp
  tmp="$(mktemp)"
  echo "Downloading $url"
  curl -fL --retry 3 --retry-delay 2 -o "$tmp" "$url"
  local got
  got="$(sha256sum "$tmp" | awk '{print $1}')"
  if [[ "$got" != "$sha" ]]; then
    rm -f "$tmp"
    echo "Hash check failed for $url" >&2
    echo "got      $got" >&2
    echo "expected $sha" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$dest")"
  mv "$tmp" "$dest"
  echo "Hash ok: $dest"
}

gguf="model/artifacts/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf"
fetch \
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf" \
  "$gguf" \
  "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e"

if [[ -n "${runtime_url}" ]]; then
  mkdir -p model/bin
  tarball="model/bin/.download.tar.gz"
  fetch "$runtime_url" "$tarball" "$runtime_sha"
  extract="$(mktemp -d)"
  tar -xzf "$tarball" -C "$extract"
  rm -f "$tarball"
  rm -rf "$runtime_dir"
  mv "$extract/llama-b12189" "$runtime_dir"
  rm -rf "$extract"
  chmod +x "$runtime_dir/llama-server"
  echo "$runtime_note"
  echo "llama-server: $root/$runtime_dir/llama-server"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  cat <<'EOF'

macOS Gatekeeper
The llama.cpp binary is downloaded from GitHub. It is not signed with an Apple Developer ID.
This setup does not remove the quarantine attribute and does not turn Gatekeeper off.
The first time llama-server starts, macOS may say it cannot be opened because the developer cannot be verified.
Approve it in the normal way:
  1. Open System Settings.
  2. Go to Privacy & Security.
  3. Under Security, find the message about llama-server.
  4. Click Open Anyway and confirm.
You can also locate llama-server in Finder, Control-click it, choose Open, and confirm Open.
After that one approval, npm run dev can launch it.
EOF
fi

if [[ ! -s .env.local ]] || ! grep -q '^DEMO_DESK_KEY=.' .env.local; then
  umask 077
  key="$(openssl rand -hex 24)"
  if [[ -s .env.local ]]; then
    printf '\nDEMO_DESK_KEY=%s\n' "$key" >> .env.local
  else
    printf 'DEMO_DESK_KEY=%s\n' "$key" > .env.local
  fi
  chmod 600 .env.local
  echo "Wrote a random DEMO_DESK_KEY into .env.local (mode 600, gitignored). The value is not printed."
else
  echo ".env.local already has DEMO_DESK_KEY. Left it unchanged and did not print it."
fi

echo
echo "Setup finished."
echo "On this same computer run: npm run dev"
echo "Then open http://127.0.0.1:43123 in a browser on this same computer."
echo "Model license: Apache-2.0 (Qwen2.5). Runtime license: MIT (llama.cpp). See THIRD_PARTY_NOTICES.md."
