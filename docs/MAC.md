# Mac setup

These steps were not run on a Mac. The Linux build machine identified the official llama.cpp b12189 archives as Mach-O arm64 and Mach-O x86_64 and did not execute them. The Linux x86_64 build of the same release was executed there.

## Interpreters

```bash
brew install node@22 python@3.12 tesseract
```

Apple silicon:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"
which node
which python3.12
node -v
python3.12 --version
```

`node -v` must print v22.x. The tested Linux version is v22.23.4. `scripts/setup.sh` exits if Node is not 22.

Intel Mac: use `/usr/local/opt/node@22/bin` and `/usr/local/bin` instead of `/opt/homebrew`.

## Install and start

```bash
unzip lean-source.zip -d udyam-digital
cd udyam-digital
bash scripts/setup.sh
npm run dev
```

`setup.sh` runs `python3.12 -m venv .venv` and installs `model/requirements.txt` with `.venv/bin/python -m pip`. It does not call the system `pip` that Homebrew marks as externally managed.

It then downloads the Qwen2.5-1.5B-Instruct Q4_K_M weights and the llama.cpp b12189 archive for this Mac, and checks the SHA-256 values in `THIRD_PARTY_NOTICES.md`.

On this same Mac, open `http://127.0.0.1:43123`.

`bash scripts/advisor-dir.sh` prints `model/bin/macos-arm64` on Apple silicon and `model/bin/macos-x64` on an Intel Mac.

## Gatekeeper

`llama-server` is a command-line tool downloaded from GitHub. It is not signed with an Apple Developer ID. `scripts/setup.sh` does not run `xattr`, does not clear the quarantine attribute, and does not disable Gatekeeper.

The first launch may show that macOS cannot verify the developer. Approve it once:

1. Open System Settings.
2. Go to Privacy & Security.
3. Under Security, find the message about `llama-server`.
4. Click Open Anyway and confirm.

Alternatively, Control-click `llama-server` in Finder, choose Open, and confirm Open. After that approval, `npm run dev` can start it. If you do not approve it, the website still runs and the advisor pill says the generative model is not loaded. Those replies are the composer, not a generated answer.
