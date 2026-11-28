# Personal model and own voice experiments

[Programme #1445](https://github.com/loftwah/app-composer/issues/1445) · [Learning corpus #1446](https://github.com/loftwah/app-composer/issues/1446) · [Own voice Studio #714](https://github.com/loftwah/composer-media-studio/issues/714)

## Outcome and current authority

Find the cheapest useful way to reach the quality expected of the projects: better system prompts, relevant retrieved examples, adapted text models, and recognisable own-voice models. Compare the finished result and the effort needed to obtain it. Training a model is one possible means, not the success measure.

On **2026/11/28 Australia/Melbourne (AEDT, UTC+11) / 2026/11/28 UTC**, the owner authorised experimentation, at least dry runs and mocks, with a total budget **strictly below A$250**. AUD is the conservative interpretation of the owner's dollar amount. This permission supersedes earlier no-training/no-spend language for this finite programme. Routine bounded research spending does not need repeated approval. Production-default changes and ongoing commitments are separate decisions.

The public material here contains methodology and synthetic fixtures. The original private project/session corpus, raw voice recordings and checkpoints stay in their authorised source store unless deliberately selected for publication. The existing fictional-only state-app restriction remains.

The completed mock results and exact source provenance are in the [experiment record](../personal-model/README.md).

## What can run now

Use the existing Benchmarks Studio runner. These commands do not call providers, download models or train anything:

```sh
node benchmarks/runner.mjs --suite AGENT-IMPROVE-01
node benchmarks/runner.mjs --suite PERSONAL-MODEL-01
```

To retain a separate receipt, add `--write --out output/personal-model-01.json`. Do not overwrite the shared full-suite result with a single pack. Inspect pass, fail **and blocked** counts: the runner may exit zero while a check is blocked.

AGENT-IMPROVE-01 exercises the existing evaluator with fictional gains, regressions and resource values. PERSONAL-MODEL-01 adds this programme's seven lanes, missing-result states, grouped-data examples and simulated budget/retry decisions. A passed mock means the workflow handled the supplied scenario; it is not a prompt improvement, fitted model, audible voice or provider-enforced spending cap.

Actual candidate scores, model latency, token use, memory and training results remain null/not-run until execution measures them. The current execution host is Linux x86_64 without a detected CUDA device or installed PyTorch; it is not the owner's Mac. No raw own-voice recording has been supplied for this experiment.

## Experiment order

| Lane | Smallest useful comparison | Real execution record |
| --- | --- | --- |
| System prompts | Current prompt versus a concise project-outcome prompt | Same model, task inputs, tools and decoding; record exact prompt versions and omissions/corrections |
| Retrieval | Same concise prompt with a bounded relevant source/example packet | Label the context change; do not attribute it solely to prompt wording |
| Text fine-tuning | Small base model plus retrieval versus the same model with an adapter | Exact base/tokeniser/adapter, training split, settings, hardware and held-out results |
| From-scratch training | Tiny educational tokeniser/data/train/checkpoint/reload/evaluate workflow | Label capability and scale; do not call it the official Nanochat speedrun |
| Voice reference | Qwen3-TTS Base conditioned on a clean own-voice clip | Conditioning is inference, not newly trained weights |
| Voice fine-tuning | Same spoken-voice baseline versus one adapted checkpoint | Real data/export, small calibration step, bounded training and checkpoint reload |
| Voice conversion | A recorded performance through a qualified conversion model | Compare cadence, timing and pitch against the input performance separately from TTS |

The fixture uses a deliberately minimal synthetic prompt A; it is not a snapshot of the current production prompt. A real comparison must capture that current prompt as its baseline.

Start with one useful task family. Screen prompt variants on development tasks; compare the selected candidate on fresh held-out tasks. Prefer existing entitlements, an available compatible local runner, and short rental jobs. The owner's work must remain usable if a local experiment would consume the Mac's resources.

## One shared budget

These allocations are planning ceilings, not provider quotes or spending targets. They cover the whole programme, not each issue, model or retry.

| Allocation | AUD |
| --- | ---: |
| System-prompt and retrieval comparison | 20 |
| Small text-model adaptation and its evaluation | 70 |
| Own-voice baseline/adaptation/conversion and evaluation | 60 |
| Tiny from-scratch demonstration | 20 |
| Setup, storage, retries and shared overhead | 30 |
| FX, payment and useful-rerun contingency | 40 |
| Planned total | **240** |
| Headroom below the strict A$250 ceiling | **10** |

For each real dispatch, reconcile settled charges, active maximum reservations, the proposed job's full exposure and retained storage. Count failed attempts. Include setup/model downloads, preprocessing, evaluation, tax and payment/FX overhead. Record prepaid cash commitments and workload consumption separately, without double-counting the same credits or hiding a top-up. Keep auto-top-ups and automatic paid retries off.

A budget check must use the actual quote, finite runtime/storage expiry and termination mechanism. If an external job outcome is uncertain, reconcile it before resubmitting. Stop compute at its reservation limit; deleting a compute process does not necessarily stop retained-storage charges. The mock here cannot perform or certify these provider controls.

### Indicative compute arithmetic

Checked **2026/11/28 AEDT / 2026/11/28 UTC**: [Runpod pricing](https://www.runpod.io/pricing) displayed US$0.89/hour for a Secure Cloud RTX 4090 and US$4.39/hour for H100 SXM. [RBA](https://www.rba.gov.au/statistics/frequency/exchange-rates.html) displayed US$0.6661 per A$1 for **2026/11/27 AEDT / 2026/11/27 UTC**. Actual purchase FX, fees, availability and tax govern admission.

At those indicative inputs, 24 hours of one 4090 is about A$32.07 for compute only. This does not predict memory fit or training duration. Multiplying the H100 rate by eight GPUs gives roughly A$498 for three 99-minute baselines plus three 90-minute candidates, before overhead. It is not a matching-node quote. Keep [#1360's](https://github.com/loftwah/app-composer/issues/1360) full reproduction contract intact and dry-run that larger campaign; a tiny educational run is the suitable from-scratch lane inside this shared budget. See [storage pricing](https://docs.runpod.io/pods/pricing) and [billing](https://docs.runpod.io/accounts-billing/billing) before dispatch.

## Data that teaches useful behaviour

For text, connect a request, the source/context available at that time, the attempted work, an observed failure or correction, the accepted result and verification evidence. Preserve accepted, rejected, superseded and unknown outcomes separately. A closed issue or an assistant's success claim alone cannot create a positive target.

Group the complete issue/PR/session and its variants before splitting into training, development and final evaluation. Keep later fixes and target answers out of historical replay retrieval as well as training. Tune with development examples; do not repeatedly optimise against the final holdout. Select preference pairs only when the same context and an actual comparison support them.

For voice, use the [recording and evaluation guide](../personal-model/recording-guide.md). Keep complete sessions/passages together; do not split neighbouring snippets from the same performance across train and test. Record exact transcripts, hashes, derivatives and pronunciation corrections.

## Model adaptation choices

[MLX-LM's LoRA/QLoRA guide](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md) is a practical text-adaptation reference on compatible Apple Silicon. Pin a currently suitable base model and its terms, preserve train/development/test files, and measure a small calibration batch. Lower precision and smaller batches change memory and throughput; the owner's 48 GB Mac is not a measured fit guarantee.

[Nanochat's CPU/MPS script](https://github.com/karpathy/nanochat/blob/master/runs/runcpu.sh) is an educational from-scratch reference. Executing it downloads data and performs training; reading or validating its plan is the dry run. The full GPT-2 CORE campaign remains a separate experiment.

[Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base) offers reference-conditioned speech and [single-speaker adaptation](https://github.com/QwenLM/Qwen3-TTS/blob/main/finetuning/README.md). Its inspected [trainer](https://github.com/QwenLM/Qwen3-TTS/blob/main/finetuning/sft_12hz.py) performs full AdamW fine-tuning rather than LoRA. Confirm hardware and batch settings; do not transpose text-model adapter estimates to this trainer.

## Evaluation, recording and iteration

For each attempt retain: hypothesis; changed variable; model/tokeniser/checkpoint/prompt/data/evaluator revisions; input and result references; available tools; seed/settings; hardware; budget reservation; state; actual output; measured time/memory/usage/cost; unknown values; feedback; and the next decision. Use the existing job and benchmark records. No separate experiment database is needed.

Text metrics are useful accepted outcomes, omissions, avoidable corrections, recurring errors, correct capability reuse and time/cost per verified result. Keep functional checks, visual/editorial judgement and actual publication/delivery state interpretable. Model self-grading is supporting feedback, not ground truth.

Voice metrics are text fidelity, recognisability, accent/pronunciation, naturalness, artefacts, generated duration, end-to-end latency, real-time factor, observed memory and cost. Conversion also needs timing, pitch and performance preservation. Randomised A/B listening against actual own-voice references is more useful than a single impressive sample.

Retain the current baseline; change one major factor, compare, and decide retain/revise/narrow/reject. A failed or inconclusive run is a useful recorded result. Only selected outcome-verified material becomes the next data revision.

## Delivery and publication

The current request authorises the programme and its bounded pilot spend. Missing audio, model/runner access or an actual cost quote is a concrete execution prerequisite, not a demand for repeated permission. Automatically adopting new production defaults is outside the experiment.

Publish methodology, dry-run receipts and later measured comparisons through existing #1354/#1360 editorial and #601/#933 result ownership. Keep private originals private. Non-runtime source/tooling work finishes on main with a focused check; it does not require an unchanged-product deploy. Preserve two active implementation units and the 120-second routine delivery target. Research does not become a new mandatory release gate.
