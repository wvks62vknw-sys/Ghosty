# Free compute beyond Kaggle's hours — research, 24 October 2026

Written up from a research builder's report (web sources read the same day; [P] the provider's own page, [3P] a third
party, [I] inference, [U] unverified). The owner's rule holds throughout: everything free, no card on file anywhere.

## What changes the baseline
- **Kaggle retired the P100 on 15 Sep 2026 [P]**; the free GPU is now two T4s (16 GB each), 12-hour sessions, about 30
  GPU hours a week (reports of less [3P]). Our push already asks for a T4. Stale texts: the notebook header, PLAN.md:23,
  BRIEF-S2.md:30.
- **Our run uses only one of the two T4s** (`cuda:0`). Sampling (STaR, the exam) on `cuda:1` in parallel is the cheapest
  extra GPU there is [I]. Whether a T4×2 hour counts once or twice against the quota is unverified [U].
- **Kaggle TPU v5e-8 [P]**: a separate 20 hours a week on the same account, 9-hour sessions, bf16; needs a torch_xla or
  JAX port of the PEFT training (no recipe found).

## The candidates
| Source | Free quota | GPU / memory | Card | API | Verdict |
|---|---|---|---|---|---|
| Kaggle T4×2 | ~30 h/week, 12 h sessions | 2 × 16 GB | none | official | **primary** (built) |
| Google Colab free | unpublished, ≤ 12 h sessions | T4 ~15 GB | none | **new official CLI (5 Jun 2026)**: `colab run --gpu T4` | second pool, test under supervision: the free-tier FAQ forbids "bypassing the notebook UI" and may kill long runs; needs a driver outside Cloudflare (a private GitHub Actions job holding the OAuth token) |
| Hugging Face ZeroGPU | **5 GPU-minutes a day** per free account | RTX Pro 6000 Blackwell, 48 GB | none | Gradio HTTP + Hub API | short jobs only: sampling and exam chunks of ≤ 300 s; data stays in the owner's HF account |
| Kaggle TPU v5e-8 | 20 h/week | bf16 | none | official | after a port [U] |
| GitHub Actions (private) | 2,000 min/month, 6 h per job | CPU, 2 vCPU 8 GB | none | REST | emergency: ~8–25 training tokens/s [I] → 150k–500k tokens per 6-h job; 0.6B only; terms a grey area |
| Lightning AI | 5 one-time credits (~9–12 T4 hours) + a free 4-vCPU Studio | T4 | none | SDK | emergency, about one run, once |
| AWS Free plan | $100–200 one-time, 6 months, then erased | G4dn [U] | none for most | yes | heavy; GPU access unverified |
| Saturn Cloud | pages contradict each other | ? | ? | ? | check by hand before counting on it |
| Modal, HF Jobs, HF CPU Spaces (paid since 2026), SageMaker Studio Lab (closed), Paperspace (public machines), Google Cloud, Azure, Oracle, Workers AI (adapters only), Intel Tiber, Deepnote, Replit, RunPod, Beam, Baseten | — | — | card or paid | — | not viable |

## Training on the phone itself (WebGPU in Safari on iOS 26)
Not viable in 2026: no maintained library trains in WebGPU (WebLLM and transformers.js are inference only; ONNX Runtime
Web trains only in its WebAssembly build; TensorFlow.js has gradients but no LLM tooling; one hobby project reports 32
tokens/s on desktop Chrome), a tab holds about 1–1.5 GB, and the phone throttles. At most a research experiment later.

## What the notebook needs for any capped or interruptible host
1. Checkpoints inside phases every 10–20 minutes (adapter, optimiser and scheduler state, data position, partial
   samples) to the owner's private HF repo, and a resume that continues mid-phase.
2. A time budget per host (Colab 1.5–2 h, GitHub 5.5 h, Lightning < 4 h, ZeroGPU 4.5 min per call); the brain and the
   gate accept a week's run spread over several sessions.
3. The device chosen at start (cuda / xla / cpu); on CPU no bf16, no STaR, no DPO.
4. Packages pinned per host (ZeroGPU: torch ≥ 2.8); the q4f16_1 quantise and the exam checked on Blackwell and on CPU [U].
5. One entry point per host; the status polling and the report hook stay the same.

## Ranking
Primary: Kaggle T4×2 (and its unused second card). Second pool: Colab free T4 through the official CLI (supervised first
run), ZeroGPU for daily sampling and exam chunks, Kaggle's TPU after a port, Saturn Cloud if its no-card tier is real.
Emergency: GitHub Actions CPU (a 0.6B top-up), Lightning's one-time credits, AWS's one-time credits.
