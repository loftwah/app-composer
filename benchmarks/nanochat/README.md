# Nanochat and Pufferfish study

This package accompanies the App Composer article at `/articles/nanochat-pufferfish`.
It contains an executed synthetic matrix demonstration and a proposed nanochat
training experiment. The GPU experiment has not been launched.

## Run the local example

Requires Python 3.12+ and NumPy. The recorded run used Python 3.12.14 and
NumPy 2.3.5 on Linux x86_64, with float64 arrays and CPU execution.

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 \
  python3 benchmarks/nanochat/pufferfish_demo.py --output /tmp/composer-low-rank-demo.json
```

The explicit output path leaves the recorded article evidence unchanged.
The script prints the same complete JSON receipt that it writes. It verifies
factor multiplication and truncated-SVD identities and compares deliberately
structured matrices with a random full-rank control. Last-bit numerical values
can vary between BLAS implementations.

The committed `results/local-demo.json` was generated on
2026/11/27 16:37:34 AEDT (Australia/Melbourne, UTC+11) /
2026/11/27 05:37:34 UTC. At rank 16, both square examples remove 75% of
their weights. Relative matrix errors are 0.0677% and 78.4449%, respectively.
These are synthetic reconstruction errors, not language-model accuracy,
Pufferfish reproduction, training speed or CORE scores.

## Proposed GPU challenge

`run-plan.json` pins the reference commit and records the capability gate,
timing convention, replication plan and required run evidence. All measured
GPU results remain null and paid compute is disabled. This is a research plan,
not a scheduler, provisioner or implementation of a low-rank nanochat model.

The reference is nanochat commit
`a825e63f81e62e2e9fd38655e9b2e39417620545`, listed at 99 minutes with
CORE 0.2626 on one 8×H100 node. The proposed first target is under 90 minutes
while exceeding full CORE 0.256525. Recheck upstream before a record attempt.

Start with an actual provider quote, approved total budget, exact hardware and
software identity, pinned data/tokenizer/evaluator hashes and a baseline
reproduction. Keep official counted time, complete elapsed time, transition
overhead and total campaign cost separately. Record every attempt.

Track implementation and publication in
[App Composer #1360](https://github.com/loftwah/app-composer/issues/1360).

## Sources

- [nanochat](https://github.com/karpathy/nanochat)
- [nanochat rules](https://github.com/karpathy/nanochat/blob/master/dev/LEADERBOARD.md)
- [Pufferfish paper](https://arxiv.org/abs/2103.03936)
- [Pufferfish implementation](https://github.com/hwang595/Pufferfish)
- [PufferLib documentation](https://puffer.ai/docs.html)

Pufferfish and PufferLib are separate projects. This demonstration imports
neither project and does not claim an upstream performance result as our own.
