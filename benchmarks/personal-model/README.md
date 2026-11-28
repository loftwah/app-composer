# Personal model experiment record

The aim is to learn which combination of prompts, retrieved project evidence, adapted models and own-voice tools reaches the owner's quality bar with less correction and useful cost. [Programme #1445](https://github.com/loftwah/app-composer/issues/1445) owns the work; [corpus #1446](https://github.com/loftwah/app-composer/issues/1446) and [Studio voice #714](https://github.com/loftwah/composer-media-studio/issues/714) own its data and voice slices.

## Completed dry runs

| Run | Melbourne time | UTC | Passed | Failed | Blocked |
| --- | --- | --- | ---: | ---: | ---: |
| Existing AGENT-IMPROVE-01 | 2026/11/28 19:08:43 AEDT | 2026/11/28 08:08:43 UTC | 13 | 0 | 0 |
| New PERSONAL-MODEL-01 | 2026/11/28 19:11:52 AEDT | 2026/11/28 08:11:52 UTC | 16 | 0 | 0 |

Incremental provider spend: **A$0**. Provider calls, model downloads and training jobs: **0**. These runs exercised fictional fixtures and decision logic. They did not measure model quality, token use, inference latency, memory fit, voice similarity or training improvement. All seven real model lanes remain **not-run**.

The new pack rehearses prompt-versus-retrieval attribution, one shared budget strictly below A$250, active reservations, charged retries, uncertain remote effects, retained storage, incomplete quotes, known group-ID split leaks, unsupported positive labels, missing voice recordings and accepted/rejected/inconclusive simulated outcomes. It does not enforce a real provider's billing or discover semantic duplicates in an unseen corpus.

## Read and reproduce

- [Experiment protocol and A$240 allocation](../operations/personal-model-01.md)
- [Own-voice recording, data and evaluation guide](recording-guide.md)
- [Synthetic experiment fixture](../fixtures/personal-model-01.json)
- [Existing replay receipt](receipts/agent-improve-replay.json)
- [New mock receipt](receipts/personal-model-01.json)
- [Source provenance and hashes](source-provenance.json)

From the repository root:

```sh
node benchmarks/runner.mjs --suite AGENT-IMPROVE-01
node benchmarks/runner.mjs --suite PERSONAL-MODEL-01
```

Use `--write --out output/personal-model-01.json` when retaining a new pack receipt. Keep previous receipts immutable. Inspect blocked counts as well as the process exit code.

## Evidence provenance and remaining work

The local replay used an exact eight-file source subset from `96c9f6ebe005bd201440e099b6e6ea01c8472884`; each Git blob hash was verified. Those dependencies are unchanged in integration base `c39c686bdb7c88cc672f1d30ed8c7db8e4194772`. This was not a Git checkout, so the runner's original `source: unknown` field is retained truthfully. The sidecar records upstream paths, revisions and blob hashes, plus the new pack and receipt SHA-256 hashes.

The first implementation edit was **2026/11/28 19:11:50 AEDT / 2026/11/28 08:11:50 UTC**. The 120-second routine integration target was exceeded during source/documentation review and connector integration. The existing programme issue records the actual integration outcome and elapsed time. This source/tooling work does not change the deployed runtime.

The next real inputs are a selected, outcome-verified task/data slice, a compatible accessible model runner with a bounded all-inclusive quote where paid, and clean own-voice recordings. The current A$250 authority covers bounded experiments in this programme without repeated budget approval. It does not automatically replace production defaults or publish private originals. Measured results will be appended through the existing benchmark and issue records, including failures and inconclusive results.
