# Third-party notices

## Qwen2.5-1.5B-Instruct

- Weights file: `qwen2.5-1.5b-instruct-q4_k_m.gguf`
- Source: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF
- Upstream model: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct and https://github.com/QwenLM/Qwen2.5
- Authors: Qwen team, Alibaba Group
- License: Apache License 2.0
- SHA-256 of the Q4_K_M file this project pins: `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`
- The weights are not in the source zip. `scripts/setup.sh` downloads that exact file and checks the hash.

The advisor sends the model only the catalogue rows and quote totals for the current business. Catalogue prices and eligibility are computed in this project's code, not by the model.

## llama.cpp

- Build: b12189
- Source: https://github.com/ggml-org/llama.cpp
- License: MIT
- Pinned archives, also downloaded and hash-checked by `scripts/setup.sh`:
  - Linux x86_64 `llama-b12189-bin-ubuntu-x64.tar.gz` `c446a7ba4df3c3b1cc880a734fbff586d6d34b9cebc09e151754813b94ded8c9` (executed on the Linux build machine)
  - macOS Apple silicon `llama-b12189-bin-macos-arm64.tar.gz` `f30e2f3032df30a0c37c9fbd43125253dcd4cb96d6a879aa81e464944bc20aee` (not executed on the Linux build machine)
  - macOS Intel `llama-b12189-bin-macos-x64.tar.gz` `c690cb11be36a910df7e3d5baf22ed2fb53c02243c72cd33aae8f5fd6c6afe55` (not executed on the Linux build machine)

## Python packages

`model/requirements.txt` pins scikit-learn 1.9.1 and numpy 2.5.4, the versions used for the reported ranker metrics. They install into `.venv` created by Python 3.12.
