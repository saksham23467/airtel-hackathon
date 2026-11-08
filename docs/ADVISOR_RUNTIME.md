# Advisor runtime

Measured on the Linux build machine on 7 November 2026. The same calls are what the website makes after discovery consent.

| Piece | Value |
| --- | --- |
| Model | Qwen2.5-1.5B-Instruct |
| Quantisation | Q4_K_M |
| File | `model/artifacts/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf` |
| SHA-256 | `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` |
| Bytes | 1,117,320,736 |
| Runtime | llama.cpp `llama-server` build b12189 |
| Device | CPU, 4 threads, GPU layers 0 |
| Listen | `127.0.0.1:43125` only |
| Status payload | `loaded: true`, model and runtime names as above |

Four Star Electronics questions, no quote saved yet, catalogue rows P07, P01 and P19 supplied as the fact packet:

| Owner line | Result | Generation time |
| --- | --- | --- |
| This is too expensive. | Generated. Named Biz Fibre 100 (P01) and Cloud POS & Billing (P19). | 4071 ms |
| I only need internet. | Generated. Named Biz Fibre 100 and copied floor Rs 999 and 12-month contract. | 2177 ms |
| The contract is too long. | Generated. Named P01 at 12 months and P07 at 1 month. | 3161 ms |
| Installation will take too long. | Generated. Named Business Fibre 100 (P01). Short. | 797 ms |

An earlier sample that wrote “Rs 100” for the 100 Mbps speed was discarded by the price guard, and the composer was shown instead. That discard is the intended behaviour: the model does not get to publish a rupee amount that is not an integer in the fact packet. After the packet’s own integers (including 100 from “100 Mbps”) were allowed, the internet question above passed with Rs 999, which is the catalogue floor.

The lean source zip does not contain the weights or the binaries. `scripts/setup.sh` downloads llama.cpp b12189. On Linux x86_64 that download was executed. The macOS arm64 and x86_64 archives from the same release were not executed on the Linux build machine. There is no public deployment of this service.
