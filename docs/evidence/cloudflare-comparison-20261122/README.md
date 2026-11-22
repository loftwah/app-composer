# Cloudflare versus optimised AWS — comparison evidence brief

Contract `composer.cloud-provider-comparison/1`, version **2026-11-22**.
Checked 22 November 2026 (Australia/Melbourne, UTC+11) for
[#1021](https://github.com/loftwah/app-composer/issues/1021). Public-safe: no
credentials, customer data, invoices or private account figures.

This is the one reusable reference behind the public
[/cloudflare](https://composer.loftwah.com/cloudflare) answer. It records what
each primary source says, how old it is, what is measured or modelled, and what
none of them can establish. It is not an invoice, a benchmark run or a provider
recommendation. [#959](https://github.com/loftwah/app-composer/issues/959),
[#253](https://github.com/loftwah/app-composer/issues/253),
[#312](https://github.com/loftwah/app-composer/issues/312) and
[#601](https://github.com/loftwah/app-composer/issues/601)/#933 consume this
reference through their existing lanes. No second knowledge store, calculator
or chatbot is added.

## The question

“Did Cloudflare save the money, or did Baselime just simplify an overengineered
AWS system?” The answer has to survive a technical reader, so it separates:

- the historical vendor result and what it actually covers;
- the possible contributors, none of which the source apportions;
- what a customer can reproduce on current public services;
- current, product-specific billing facts;
- the decision rule, including staying put.

## Source record

| Source | Publisher | Original date | Checked | What it supports | Status |
| --- | --- | --- | --- | --- | --- |
| [Moving Baselime from AWS to Cloudflare](https://blog.cloudflare.com/80-percent-lower-cloud-cost-how-baselime-moved-from-aws-to-cloudflare/) | Cloudflare | 31 October 2024 | 2026-11-22 | The daily and annual comparison table, the migration method, the internal Analytics Engine and adaptive-resolution changes, the migration effort | Vendor estimate. AWS side reported by Baselime/Cloudflare; Cloudflare side modelled |
| [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/) | AWS | No publication date on page | 2026-11-22 | Event Functions bill requests plus GB-seconds of configured memory across duration; Web Functions bill requests, active CPU, environment memory and transfer; current unit rates and free tiers | Current list prices, US East (N. Virginia) examples |
| [AWS Lambda Web Functions](https://aws.amazon.com/lambda/lambda-web-functions/) | AWS | No publication date on page | 2026-11-22 | Web Functions execution model: multi-concurrency, I/O wait not billed as CPU, memory billed for the environment’s lifetime | Current product description |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | Cloudflare | Document modified 2026-11-18 | 2026-11-22 | Standard model: 10M requests and 30M CPU ms included, $5 monthly account minimum, published examples; account-wide spending limit; Durable Objects duration | Current list prices |
| [Workers spending limits](https://developers.cloudflare.com/workers/platform/spend-management/) | Cloudflare | Document modified 2026-11-13 | 2026-11-22 | A Workers limit blocks new invocations across the whole account, excludes the subscription fee, does not cover other products, and is not per-invocation CPU control | Current documented behaviour |
| [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) | Cloudflare | Document modified 2026-11-13 | 2026-11-22 | Requests plus wall-clock duration in GB-s while active or unable to hibernate; separate storage charges | Current list prices |
| [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) | Cloudflare | Document modified 2026-04-23 | 2026-11-22 | 10M data points and 1M read queries included; published rates are prospective and **usage is not currently billed** | Prospective, explicitly unbilled |
| [Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/) | Cloudflare | Document modified 2026-04-23 | 2026-11-22 | Three-month retention, 250 data points per invocation, 20 blobs/20 doubles/1 index, 16 KB of blobs per point, 96-byte index | Current published limits |

“Document modified” is documentation metadata, not a pricing effective date.
The AWS page publishes no effective date; its worked examples are US East
(N. Virginia), and the Web Functions examples use Arm. Recheck the applicable
region, account, plan and effective price before quoting a new comparison.

## Historical result, exactly as published

Currency USD. Workload: Baselime’s observability data pipeline, reported from a
single AWS region (`eu-west-1`) before migration. The post was written after
Cloudflare acquired Baselime in April 2024.

| Item | AWS before | Cloudflare after |
| --- | --- | --- |
| Compute | $650/day — AWS Lambda | $25/day — Workers (modelled) |
| CDN | $140/day — CloudFront | $0 — free |
| Stream and analytics database | $1,150/day — Kinesis Data Stream + EC2 | $300/day — Workers Analytics Engine (modelled) |
| Daily total | $1,940 | $325 |
| Annualised × 365 | $708,100 | $118,625 |
| Difference | — | $589,475; 83.25% by subtraction (1 − 325 ÷ 1,940) |

The post’s own table rounds the result to 83% and its text says “over 80%”. The
83.25% is arithmetic on the published figures, not a new measurement. The
destination column is an estimate for “a regular Cloudflare customer”, based on
Workers Paid; it is a model, not Baselime’s invoice.

## Contributors the source does not separate

| Contributor | What the post describes | Quantified? |
| --- | --- | --- |
| Provider billing model | Workers charges CPU time; Lambda Event Functions charged duration while receptors waited on I/O, over 70% of wall time | No |
| Redesign and simplification | Hundreds of Lambda functions, dozens of databases and queues reduced to fewer services; Firehose/S3/SQS retry orchestration removed | No |
| Managed-service substitution | Self-hosted ClickHouse on EC2 and Kinesis replaced by Workers Analytics Engine; Durable Objects replaced ElastiCache, Kinesis and coordination Lambdas | No |
| Query behaviour | Adaptive Bit Rate tables from 100% to 0.0001% resolution, selected per query, with an accuracy trade-off | No |
| Data placement | Single AWS region to a global network | No |
| Operating work | Fewer pages, less infrastructure monitoring; total cost of ownership explicitly excluded | No |

The migration was also a rewrite: a strangler-fig move, dual-writing to
ClickHouse and Analytics Engine for the 30-day retention window, endpoint
rewrites, and a stated three-engineer team for under three months. Any causal
percentage would need controlled one-factor ablations; the post has none. Treat
the mechanisms as plausible explanations, never as measured shares.

## What a customer can reproduce today

The post’s query design is not a published customer feature. The public
Analytics Engine contract is narrower:

- three months of retention;
- 250 data points per Worker invocation;
- up to 20 blobs, 20 doubles and one index per point;
- 16 KB total blobs per data point and a 96-byte index;
- no documented customer-selectable exact-versus-sampled switch, accuracy
  guarantee or arbitrary retention export.

Before presenting the Baselime design as reproducible, require explicit
availability on the chosen plan, exact-versus-sampled query semantics, an
accuracy tolerance, retention coverage and a working export. Where a requirement
cannot be met, that is an unsupported requirement, not a free efficiency.

## Current billing facts that change the comparison

- **AWS Lambda Event Functions** charge requests plus GB-seconds of configured
  memory for the duration the function runs, including time spent waiting.
  Published example rates: $0.20 per million requests and
  $0.0000166667 per GB-second, with 1M requests and 400,000 GB-s in the free
  tier.
- **AWS Lambda Web Functions** charge requests, active CPU, the memory each
  execution environment consumes for as long as it runs (including between
  requests), and data transfer. Published Arm example rates: $0.30 per million
  requests, $0.0000276944 per vCPU-second and $0.0000036667 per GB-second.
  I/O wait is not billed as CPU, but the environment’s memory still is.
- **Workers Standard** charges requests and CPU milliseconds after the included
  10M requests and 30M CPU ms, with a $5 monthly account minimum. Maximum CPU is
  5 minutes per invocation (30 seconds default).
- **Durable Objects** bill requests plus wall-clock duration while active or
  unable to hibernate, and storage separately.
- **Analytics Engine** publishes 10M points and 1M queries included, then
  $0.25 per million points and $1.00 per million queries — and states that usage
  is not currently billed, so a current comparison must not present those rates
  as cash.
- **Workers spending limit** stops new invocations across every Worker in the
  account at the threshold, excludes the subscription fee, does not cover
  Durable Objects, R2 or other products, and is not a substitute for a
  per-invocation CPU limit. It is a guardrail with an availability trade-off,
  not a cap on the whole bill.

## Excluded from the historical estimate

Cloudflare states its figures “do not include the total cost of ownership”.
Also outside the table: migration labour (three engineers, under three months),
dual-running during migration, support and commitments, taxes, egress and
inter-region traffic beyond the listed lines, training, the revert path, and
continuing operations. The public page’s Creator Hub readings are our own
measurements at small volume and remain separate from this vendor estimate.

## Decision outcomes

| Outcome | When it applies |
| --- | --- |
| Stay | The current design meets the requirement and the saving is unproven |
| Simplify in place | The bill is dominated by avoidable hops, idle capacity or an unsuitable execution model |
| Hybrid | One component genuinely needs a different runtime, data location or managed service |
| Migrate | A measured, like-for-like comparison clears migration and continuing-operation cost |
| Insufficient evidence | Price, region, requirement parity or usage data is missing; do not guess |

“Insufficient evidence” is a valid result. Neither 83.25% nor a preferred
provider is a success target.

## Status of our own comparison — not run

[#1022 CLOUD-COST-01](https://github.com/loftwah/app-composer/issues/1022) owns
the bounded comparison: one frozen owned workload, with an owned baseline, a
credible optimised AWS design and a Cloudflare-native design that meet the same
requirements. **No suite exists in Benchmarks Studio yet, so the run is
not-run.** There are no measured arms, no requirement-parity matrix, no
cost-per-successful-outcome figure and no savings percentage. This brief does
not substitute for that run, and the public page says so.

## Non-claims

- Not an independently audited saving, invoice, benchmark or like-for-like
  provider comparison.
- No apportionment between provider pricing and redesign.
- No claim that Cloudflare is cheaper for any given workload, or that AWS
  cannot be optimised to a similar result.
- No claim that Baselime’s internal Analytics Engine changes are available to
  customers.
- No App Composer production, customer or Creator Hub result is inferred from
  the 2024 post.
