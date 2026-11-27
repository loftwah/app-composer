---
layout: "../../layouts/Article.astro"
title: "Nanochat, Pufferfish and the race below 90 minutes"
description: "A reproducible challenge for App Composer: study small-model training, test the low-rank idea, and try to beat nanochat's 99-minute reference."
cover: "/articles/nanochat-pufferfish-20261127.png"
coverAlt: "Nanochat's published reference is 99 minutes. App Composer's proposed target is below 90 minutes, on eight H100 GPUs with CORE above 0.256525. The target is unmeasured."
coverCaption: "An authored comparison of the published reference and our proposed target. The target is unmeasured; this graphic contains no App Composer GPU training result."
published: "2026-11-27"
publishedLabel: "2026/11/27 AEDT (UTC+11) / 2026/11/27 UTC"
---

> Study nanochat and pufferfish. There will be no further context.

That is a pretty good way to send someone down a rabbit hole. It also makes a useful brief for App Composer: take a small, understandable AI project, work out what makes it good, and produce something another person can run and inspect.

Here is the challenge we want to attempt: **reach nanochat's GPT-2 capability threshold in under 90 minutes on the same eight-H100 hardware class as its published 99-minute reference.** Reproduce the baseline first. Pin the baseline source and evaluation. Record every candidate change. Publish the experiments, including the ones that fail.

We have started with something smaller and executable: a CPU experiment showing when low-rank factorisation preserves a matrix's behaviour and when it throws most of that behaviour away. The code and actual results are below. The full GPU challenge is the next research stage.

## Nanochat makes the whole training loop visible

[Andrej Karpathy's nanochat](https://github.com/karpathy/nanochat) brings tokenisation, pretraining, fine-tuning, evaluation and inference into a compact codebase. Its depth setting scales a family of models, so you can study a smaller run before paying for a larger one.

That is useful because it puts the machinery within reach. You can follow how text becomes tokens, how the network predicts them, how optimisation changes its weights, and how an evaluator decides whether the result improved. A chat window becomes the final stage of a process you can inspect.

For App Composer, that is an excellent kind of reference project. The learning comes from connecting the recipe to the result: exact source, a runnable experiment, a clear comparison and an explanation someone else can challenge.

## What does beating nanochat actually mean?

The published leaderboard's objective is **time to GPT-2 capability**. A run must exceed a DCLM CORE score of **0.256525** on one **8×H100** node. Among qualifying runs, lower training time wins. The inspected leaderboard lists **1.65 hours, or 99 minutes**, with **CORE 0.2626**, at commit `a825e63`. [Leaderboard and reference results](https://github.com/karpathy/nanochat#time-to-gpt-2-leaderboard)

That gives us three different things to keep straight:

<div class="table-scroll" tabindex="0" role="region" aria-label="Nanochat benchmark and App Composer target">
<table>
<thead><tr><th>Measure</th><th>Reference or rule</th><th>Our use</th></tr></thead>
<tbody>
<tr><td>Capability gate</td><td>CORE &gt; 0.256525</td><td>Every candidate must clear it</td></tr>
<tr><td>Published training time</td><td>99 minutes</td><td>Reproduce this pinned reference</td></tr>
<tr><td>Proposed first target</td><td>Under 90 minutes</td><td>Unmeasured research goal</td></tr>
<tr><td>Complete run cost</td><td>Provider's actual bill</td><td>Include setup, evaluation and failed runs</td></tr>
</tbody>
</table>
</div>

The clock needs care. Upstream counts training iterations and excludes evaluation and logging; its trainer also omits initial warm-up iterations from the accumulated figure. Running the entire shell script includes other work. We will retain the upstream timing convention and separately record complete elapsed time and charges. A factorisation experiment must also expose its transition and recompilation overhead rather than let that work disappear between timers. [Rules](https://github.com/karpathy/nanochat/blob/master/dev/LEADERBOARD.md) · [Training implementation](https://github.com/karpathy/nanochat/blob/a825e63f81e62e2e9fd38655e9b2e39417620545/scripts/base_train.py)

CORE is also easy to misread. It averages chance-adjusted task scores. For a four-choice task, 50% accuracy against a 25% chance baseline becomes:

```python
accuracy = 0.50
chance = 0.25
adjusted_score = (accuracy - chance) / (1 - chance)
print(round(adjusted_score, 4))  # 0.3333
```

So a CORE score of 0.2626 does not mean 26.26% of all questions were answered correctly. The task mix and evaluator are part of the result. [Pinned evaluator](https://github.com/karpathy/nanochat/blob/a825e63f81e62e2e9fd38655e9b2e39417620545/scripts/base_eval.py)

Here are three **invented examples** that make the objective concrete:

<div class="table-scroll" tabindex="0" role="region" aria-label="Illustrative benchmark outcomes, not measured runs">
<table>
<thead><tr><th>Illustrative run</th><th>CORE / time</th><th>Interpretation</th></tr></thead>
<tbody>
<tr><td>Fast, insufficient capability</td><td>0.2500 / 80 min</td><td>Fails the capability gate</td></tr>
<tr><td>Higher score, longer training</td><td>0.2800 / 110 min</td><td>Interesting model; no speed improvement</td></tr>
<tr><td>Faster, sufficient capability</td><td>0.2630 / 89 min</td><td>Candidate improvement requiring replication</td></tr>
</tbody>
</table>
</div>

Reaching 90 minutes would reduce the rounded reference time by about 9.1%. Going below it is a concrete first ambition. Before launching, we will check the leaderboard again: beating this pinned reference and setting the current record are separate claims if upstream has moved.

## First, name the fish

There are two relevant projects with fish in the conversation.

**[Pufferfish](https://github.com/hwang595/Pufferfish)** is the implementation accompanying *Pufferfish: Communication-efficient Models At No Extra Cost*, by Hongyi Wang, Saurabh Agarwal and Dimitris Papailiopoulos. It studies training with low-rank factors.

**[PufferAI's PufferLib](https://github.com/PufferAI/PufferLib)** is a separate reinforcement-learning system. Its lessons concern fast simulation, GPU execution and choosing experiments by the time needed to reach a useful score.

We will use the precise names. Low-rank Pufferfish supplies one candidate training idea. PufferLib supplies a broader lesson about measuring useful learning. Neither project establishes that we can improve nanochat by attaching it to the repository.

## Pufferfish asks whether a smaller representation can do the job

The low-rank method begins with dense training, factorises selected weights using truncated singular value decomposition, then continues training the factors. It retains some layers at full rank to protect quality. The original work studies distributed training, where smaller factors can reduce both computation and communication. Its warm-up and layer-selection choices matter. [Pufferfish paper](https://arxiv.org/abs/2103.03936)

The basic arithmetic is approachable. A dense 1,024-by-1,024 matrix contains 1,048,576 numbers. Representing it as a 1,024-by-128 matrix multiplied by a 128-by-1,024 matrix uses 262,144 numbers.

```python
width = 1024
rank = 128

dense = width * width
factored = width * rank + rank * width

print(dense)                     # 1048576
print(factored)                  # 262144
print(1 - factored / dense)      # 0.75
```

That is **75% fewer weights in this projection**. For row-vector inputs, a factored computation looks like this:

```python
# W has shape (1024, 1024).
# A has shape (1024, 128); B has shape (128, 1024).
dense_output = x @ W
factored_output = (x @ A) @ B
```

The important question is what happens to the output. If `W` really equals `A @ B`, the expressions agree apart from numerical rounding. If the factorisation discards directions that matter, it changes what the layer can express.

Fewer weights therefore give us a hypothesis to test. The extra multiplication, intermediate activations, kernel shapes, communication and any additional learning needed to recover quality all affect the complete training time.

## We ran the small experiment

The [demonstration script](https://github.com/loftwah/app-composer/blob/main/benchmarks/nanochat/pufferfish_demo.py) uses NumPy on CPU with a fixed random seed. It makes two 128-by-128 matrices: one deliberately built around a rank-16 signal with a small full-rank tail, and one random full-rank control. It compresses both to rank 16 and measures reconstruction error.

Both representations shrink from **16,384 to 4,096 weights**. Their errors are very different:

<div class="table-scroll" tabindex="0" role="region" aria-label="Measured synthetic CPU factorisation results">
<table>
<thead><tr><th>Matrix</th><th>Stored-weight reduction</th><th>Relative matrix error</th></tr></thead>
<tbody>
<tr><td>Low-rank signal plus small tail</td><td>75%</td><td>0.0677%</td></tr>
<tr><td>Random full-rank control</td><td>75%</td><td>78.44%</td></tr>
</tbody>
</table>
</div>

Those are **measured synthetic matrix results**, not language-model accuracy or a training speedup. Relative matrix error is the size of the reconstruction difference divided by the size of the original matrix, using the Frobenius norm.

The script also checks an exactly factorised rectangular matrix. Multiplying through its two factors matches multiplying through the reconstructed dense matrix to a relative output error of roughly `5.52e-16`. That checks the algebra. The random control shows why the algebra alone cannot justify compressing a trained model.

Run the same demonstration from the App Composer repository, with NumPy installed:

```bash
python3 benchmarks/nanochat/pufferfish_demo.py --output /tmp/composer-low-rank-demo.json
```

The [recorded result](https://github.com/loftwah/app-composer/blob/main/benchmarks/nanochat/results/local-demo.json) includes the environment, seed, shapes, errors and script hash. It was produced on **2026/11/27 16:37:34 AEDT / 2026/11/27 05:37:34 UTC**. No GPU training was involved.

This leaves us with a useful research question: **does a particular part of a trained nanochat model have enough exploitable structure to save time without losing the capability we need?**

## PufferLib contributes another useful habit

PufferLib trains policies that learn from actions and rewards. Its current documentation describes a native CUDA backend, parallel environments, preallocated memory and GPU graph replay. These are choices for its own reinforcement-learning workload. [PufferLib documentation](https://puffer.ai/docs.html)

The lesson we want to carry across is its attention to the time needed to solve the task. Its engineering account describes profiling the actual work and reducing overhead; its Protein tuning work considers both score and experiment cost. [Engineering account](https://puffer.ai/blog/engineering-4.0/) · [Protein](https://puffer.ai/blog/protein/)

For a language model, more tokens per second helps only if the model reaches the required capability sooner. If a change makes each step 20% faster but needs twice as many steps, we have made the research goal harder.

For App Composer's games, PufferLib also suggests an independent experiment: train and inspect a small policy in a deliberately bounded environment. Its documented CUDA Breakout example, after setting up the compatible source environment, is:

```bash
./build.sh breakout --cu
./puffer train
./puffer eval latest
```

We have not run that GPU example here. Its reward and environment-step measurements would belong in their own report, with a playable demonstration. They cannot be substituted for nanochat's language-model evaluation.

## Our route to a credible attempt

### 1. Reproduce the reference

Start from the exact commit associated with the 99-minute entry:

```bash
git clone https://github.com/karpathy/nanochat.git
cd nanochat
git checkout a825e63f81e62e2e9fd38655e9b2e39417620545

# On an authorised, suitably configured 8xH100 CUDA node.
# Review the script and the provider's charges before launching.
bash runs/speedrun.sh
```

This is a launch recipe. The [pinned script](https://github.com/karpathy/nanochat/blob/a825e63f81e62e2e9fd38655e9b2e39417620545/runs/speedrun.sh) covers more than timed pretraining, so preserve its stage logs. Record GPU model and topology, CUDA and package versions, source revision, data and tokenizer identity, and evaluator hashes. Keep the baseline's outputs separate from later candidates.

For the final comparison, use the full CORE evaluation. In the pinned trainer, `--core-metric-max-per-task=-1` selects all examples; the standalone evaluator uses `--max-per-task=-1`. A sampled progress score is useful during development but cannot replace the full result. [Training options](https://github.com/karpathy/nanochat/blob/a825e63f81e62e2e9fd38655e9b2e39417620545/scripts/base_train.py) · [Evaluation options](https://github.com/karpathy/nanochat/blob/a825e63f81e62e2e9fd38655e9b2e39417620545/scripts/base_eval.py)

### 2. Find a bottleneck before choosing the fix

Measure where the baseline spends its time. Candidate explanations include input stalls, unfavourable matrix shapes, memory movement, communication or learning settings that spend extra steps for little benefit.

The Pufferfish-inspired hypothesis is to factorise selected later MLP projections after dense warm-up. It is a research candidate. We would need to handle optimiser state, parameter grouping, checkpoint compatibility and compiled graphs correctly. If the transition costs more than it saves, or quality falls too far, the result is a useful rejection.

The same experiment log should accept simpler wins. A data-loading fix is valuable if it reliably saves time. The goal does not require low-rank factorisation to be the answer.

### 3. Screen cheaply, then test at the actual scale

Use smaller nanochat models to reject poor ideas. Change one main variable at a time and retain the dense control. A smaller-model result earns a larger experiment when it shows a convincing improvement; it does not inherit the large-model benchmark label.

Keep validation data fixed and out of training. Record dataset changes explicitly. An improvement in validation bits per byte is interpretable only against a matching evaluation corpus and procedure. The upstream leaderboard itself flags the comparability break introduced by its dataset change. [Benchmark notes](https://github.com/karpathy/nanochat/blob/master/dev/LEADERBOARD.md)

### 4. Repeat the promising result

Plan at least three full baseline runs and three full candidate runs, subject to an agreed compute budget. Predeclare the seeds and stopping rule. Report every attempt, pass rate, individual scores, mean, median, spread and total cost. Three runs are an initial replication check; a borderline result may need more evidence.

Publish both clocks: the comparable upstream training measure and the full time spent getting the result. Retain failures and expensive dead ends in the campaign cost. Upstream acceptance remains a maintainer decision even if our measured comparison improves.

## What does the experiment cost?

Use the provider's actual node-hour price. For an **illustrative assumption of US$24 per node-hour**, the arithmetic is:

```python
node_hour_usd = 24.00  # Assumption, not a current provider quote.
baseline_minutes = 99
target_minutes = 90

baseline_training = baseline_minutes / 60 * node_hour_usd
target_training = target_minutes / 60 * node_hour_usd
six_runs = 3 * baseline_training + 3 * target_training

print(f"Baseline counted training: US${baseline_training:.2f}")
print(f"Target counted training:   US${target_training:.2f}")
print(f"Three of each:             US${six_runs:.2f}")
```

The outputs are **US$39.60**, **US$36.00** and **US$226.80**. These cover only the stated training durations. The actual bill includes the rest of the rental time, evaluation, setup, storage and failed experiments. The planned 90-minute figure is an input to this illustration, not a measured cost saving.

Our [run plan](https://github.com/loftwah/app-composer/blob/main/benchmarks/nanochat/run-plan.json) keeps paid launch disabled and GPU result fields empty. The next paid step needs an actual quote and an agreed total spending limit.

## Where App Composer and Cloudflare fit

The useful product is a research workflow a creator can understand: choose a question, inspect the experiment, run it with the appropriate resources, compare the evidence and publish the result.

Our proposed division of work is straightforward:

<div class="table-scroll" tabindex="0" role="region" aria-label="Proposed App Composer research responsibilities">
<table>
<thead><tr><th>Part</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td>Creator's chosen agent</td><td>Study the code, propose a bounded change and explain the evidence</td></tr>
<tr><td>Authorised GPU runner</td><td>Execute the pinned training and evaluation</td></tr>
<tr><td>App Composer</td><td>Connect the brief, source, run status, comparison and publication</td></tr>
<tr><td>Cloudflare D1 and R2</td><td>Retain structured run metadata and permitted artefacts</td></tr>
<tr><td>Workers AI</td><td>Optional evidence-grounded explanations using supported inference models</td></tr>
</tbody>
</table>
</div>

[D1](https://developers.cloudflare.com/d1/) supplies the SQL store, [R2](https://developers.cloudflare.com/r2/) object storage, and [Workers AI](https://developers.cloudflare.com/workers-ai/) model inference. This is a proposed use of those services. The GPU training job has its own runner and bill; serving a custom nanochat checkpoint would need a separately supported deployment path.

This fits App Composer's [existing project architecture](https://github.com/loftwah/app-composer/blob/main/ARCHITECTURE.md#federated-project-architecture): the selected agent and connected systems do the work they support, while Composer helps the creator follow and operate the project. We would extend the existing Benchmarks and Share surfaces after the experiment demonstrates what they need.

We want someone to open a result and answer four questions without guessing: **What changed? Did it help? What did it cost? Can I reproduce it?** Useful Workers AI explanations can make that evidence accessible to more people, while the measured values remain grounded in the run files.

## The result we want to earn

The first local experiment has already taught us something worth publishing: using 75% fewer stored weights can leave a structured matrix almost unchanged and badly damage a random one. The structure is the opportunity. Preserving the useful behaviour is the work.

Now we want to take that discipline to nanochat. Reproduce the reference, try a small number of well-chosen ideas, and earn a repeatable result below 90 minutes. If the low-rank idea fails, publish why. If a simpler change wins, publish that. If an improvement is suitable for upstream, contribute it.

That would give App Composer a useful demonstration of its ambition: an idea becomes an inspectable experiment, and the experiment becomes knowledge other people can use.

[Follow the experiment and publication status](https://github.com/loftwah/app-composer/issues/1360) · [Run the local example](https://github.com/loftwah/app-composer/tree/main/benchmarks/nanochat) · [Inspect nanochat's current leaderboard](https://github.com/karpathy/nanochat#time-to-gpt-2-leaderboard)
