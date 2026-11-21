# CF-TRANSPORT-01 — Cloudflare inbound TCP / bidirectional gRPC experiment

**Status: local experiment executed; Cloudflare production-path trial NOT RUN.** Reviewed 2026/11/21 AEDT (UTC+11), corresponding to 2026/11/21 UTC. This is a bounded extension to App Composer's existing [Benchmarks Studio #601](https://github.com/loftwah/app-composer/issues/601) and [Cloudflare composition campaign](../README.md). It does **not** create a new benchmark engine, override the published six-journey denominator, ship a product feature, or authorise paid Cloudflare provisioning.

## Product question

When should App Composer recommend native HTTP, HTTP+SSE, WebSockets, Worker `connect()`/TCP, or Spectrum→Worker→Durable Object→Container running gRPC, and can EmDash Admin/MCP expose an understandable decision with costs and permissioned deployment?

**Current architecture hold:** The [enterprise integration owner #255](https://github.com/loftwah/app-composer/issues/255) explicitly forbids Composer provisioning persistent integration servers. An isolated Container experiment does not revoke that policy. Existing integration targets remain external; productising managed Containers for other app workloads requires a separate explicit decision and ownership. Do not make persistent TCP/gRPC a default.

## Verified platform facts (as of 2026/11/21)

- Inbound TCP Worker `connect()` and bidirectional gRPC via Containers are **public beta**. The Worker forwards encrypted HTTP/2 bytes rather than parsing gRPC.
- Spectrum Worker origin requires Pro/Business or Spectrum Enterprise, and a same-account zone/Worker. Without Spectrum Enterprise, Pro/Business allow **one Worker-origin application per zone on one TCP port**, with no TCP port ranges, **no edge TLS termination** and TLS terminated in the Container/backend.
- Cloudflare's example requires Containers, a paid Cloudflare zone, Docker, a Secrets Store, TLS certificate/key, and `cf` CLI. Access, pricing and suitability must be verified; a Workers Paid subscription alone does not make Spectrum free.
- Cloudflare documents that stateless Container autoscaling is not built in yet and cold starts can often be 1–3 seconds depending on workload. Test them, do not treat those numbers as measured for us.

Primary sources: [official 2026/11/19 changelog](https://developers.cloudflare.com/changelog/post/2026-11-19-inbound-tcp/), [complete gRPC example](https://developers.cloudflare.com/containers/examples/bidirectional-grpc/), [Spectrum Worker routing](https://developers.cloudflare.com/spectrum/how-to/route-tcp-traffic-to-a-worker/), [protocols by plan](https://developers.cloudflare.com/spectrum/protocols-per-plan/), [Container FAQ](https://developers.cloudflare.com/containers/faq/), [Container pricing](https://developers.cloudflare.com/containers/platform/pricing/).

## What has been executed (LOCAL only)

`local_probe.py` exercises **real application-level echo over HTTP POST+SSE, WebSockets and bidirectional gRPC/HTTP2** on `127.0.0.1`, using one Python process. The gRPC implementation uses `grpcio` and Protobuf `BytesValue`, not a hand-written TCP imitation. All carry the same JSON application payload and require a synthetic bearer token. It records matched per-message round-trip, message integrity, elapsed time, throughput and unauthorised-denial controls.

### Reproduce

Requires Python 3.11+ and **only** the independent experiment requirements; no App Composer root install/deploy:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python local_probe.py --messages 75 --clients 1 10 --payloads 128 4096 --repeats 5 --out ./local-results.json
```

This creates a local ephemeral loopback service. The command does not access Cloudflare, deploy, spend, fetch external application data or publish any network port. Package installation retrieves dependencies; use your approved package mirror/cache if needed. The checked-in evidence JSON was collected separately in an isolated Python environment. Run the probe with the pinned versions in `requirements.txt` and compare the environment receipt, not just the numbers.

**Observed run:** Python 3.13.5, Linux 6.18 x86_64, `grpcio 1.80.0`, `aiohttp 3.13.3`, `websockets 16.0`, `protobuf 6.33.6`. 60 cases = 3 transports × 2 concurrency levels × 2 payload sizes × 5 repetitions; **24,750/24,750 messages echoed correctly**, and three unauthorised-denial checks passed. The exact per-case raw observations are in `evidence/local-20261121.json`. No assertion of live Cloudflare behaviour.

| Clients | Payload | HTTP+SSE median p95 | WebSocket median p95 | gRPC median p95 | WS median throughput | gRPC median throughput |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 128 B | 0.260 ms | 0.078 ms | 0.210 ms | 14,730/s | 5,208/s |
| 1 | 4096 B | 0.259 ms | 0.144 ms | 0.239 ms | 8,073/s | 4,313/s |
| 10 | 128 B | 1.392 ms | 0.651 ms | 1.561 ms | 17,841/s | 8,713/s |
| 10 | 4096 B | 2.238 ms | 1.395 ms | 1.431 ms | 8,925/s | 9,955/s |

Numbers are the **median of five independently recorded run-level p95 values**, not a pooled p95. Throughput is likewise the median of five per-run throughputs. The workload is a strictly serial request–response per client (up to ten concurrent clients); it does not test pipelining or broadcast. Server/client in the same process means transport-library overhead, task scheduling and socket behaviour dominate; localhost sub-millisecond differences are not proof of global latency, p99 tail, scalability or relative costs. No TLS, cold starts, region-to-region network, Worker/DO routing, Spectrum, D1/Queues, attack protection, real authenticated users or billing. **Do not ship or advertise a speed winner from these figures.**

## Cloudflare trial — specified, NOT RUN

**Required owner gates:** explicitly approved disposable Cloudflare account/zone and spending ceiling, qualified Spectrum and Containers entitlement, TLS cert/Secrets Store, and isolated subdomain. Do not repurpose `composer.loftwah.com`, any current production zone's one Spectrum slot, an existing backend, customer resources or paid quota without approval. Pin Worker, Container image digest, client/harness SHA, region, instance type, cf CLI and runtime versions.

1. **Positive controls / comparable architecture:** implement an echo service in one Container image with equal message semantics and auth, exposed in three isolated configurations: HTTPS POST+SSE via Worker→DO→Container; WebSocket via Worker→DO→Container; and TLS gRPC via Spectrum→Worker `connect()`→DO `connect()`→Container `getTcpPort`. Distinguish **end-to-end architecture** performance from **raw transport** overhead. Measure a separately named external-existing-gRPC compatibility proof if available; do not mix it with echo results.
2. **Matrices:** 128 B / 4 KiB / 64 KiB; 1 / 10 / 100 active clients within an explicit load ceiling; Australia and at least one geographically distinct probe; at least five independent repeats per cell after a recorded warmup. Test 0→1 cold start and 1→N warm run independently; p50/p95/p99, error/timeout/abort counts, throughput, connection setup and first-message time, recovery and p95 over repeated long-lived sessions. For saturation, bound duration/concurrency and abort on budget/health thresholds.
3. **Correctness and negative controls:** independent payload checks; distinct client/tenant boundaries; missing/revoked token; invalid TLS certificate; oversized frame; half-close; cancel; idle timeout; disconnection/reconnection; client backpressure; ungraceful Container restart; loss of Worker/DO; duplicate/replayed message. Record concrete observed state and false-success cases. No arbitrary public unauthenticated TCP echo.
4. **Operational controls:** deploy/rollback and real round-trip verification within the established two-minute routine-release target where applicable, cold start and Containers scheduling, no accidental release impact, logging/traces and redacted receipt IDs. Explicitly record limitations of Spectrum L4 protection vs ordinary HTTP WAF and the absence of edge TLS termination on non-Enterprise Worker-origin zones.
5. **True cost:** billable Zone/Spectrum add-on, Workers, Durable Objects, Container provisioned memory/disk, active CPU, network and TLS/ops setup. Use actual invoice or account-observed costs where available; otherwise preserve a clearly sourced **estimate** and leave unknowns unknown. Report per 1 million successful messages *and* per typical monthly user workload, including idle/cold/retry costs. Compare feature/operational value, not only unit latency.
6. **Evidence:** exact pinned revisions, target/scope permission receipt, client location, environment, script, raw anonymised timings, errors, actual invoices/estimates, cleanup receipt and decision. Store in the existing #601 evidence/history/UX (#933) contract; hand actionable verified gaps to #1037 Cloudflare wishlist. Any signed or public results need separate owner approval.

## Decision matrix and gates

| Candidate | Interim decision | When to change it |
| --- | --- | --- |
| HTTP/HTTPS and HTTP+SSE | **ADOPT / current default** for ordinary web, MCP Streamable HTTP, normal EmDash actions and most app backends | Only change for a concrete unsupported feature or measured outcome advantage |
| WebSockets | **ADOPT selectively** for browsers, agent event feeds and interactive applications needing bidirectional real-time messages | Keep current Worker/DO model while it meets actual correctness, cost and latency targets |
| Native Worker inbound TCP | **EXPERIMENT ONLY** for a protocol-specific client or existing integration unavailable over secure HTTPS/WS | Auth, no Zone-slot conflict, TLS, operational safety and measured outcome must pass |
| Spectrum + Worker + DO + Container gRPC | **DEFER as general default; qualify as optional niche** for true gRPC interoperability or a verified workload improvement | Pass all security/feature gates **and** achieve either unique necessary interoperability, reproducible ≥20% lower fully loaded cost, or ≥25% better task-specific p95 without meaningful reliability/security regression. These are review thresholds, not automatic production approval |
| General multi-tenant arbitrary TCP hosting | **REJECT for launch default** at this entitlement/feature maturity | Reconsider if multi-port economics, tenant isolation, protection, lifecycle, pricing and supported billing demonstrably change |

**Do not override the #255 persistent-server prohibition for enterprise integrations.** If a feature truly needs a managed Container, first prove a discrete user benefit, correct owning product/tenant permissions, approved cost, explicit lifecycle, backup/exit and a dedicated new exception decision. Better performance alone does not justify an architecture policy reversal.

## Next actionable decisions

1. Integrate the local executable probe as a **recorded local-only fixture**; label evidence precisely in Benchmarks Studio. This does **not** pass live cloud acceptance.
2. Verify Cloudflare plan and Spectrum paid add-on pricing, one available staging-zone slot, Secrets Store, TLS and Containers entitlement with the account owner. Until then live phase is **BLOCKED (missing approved resources)**, not pass/fail.
3. If approved, run the smallest live proof first: one authenticated TLS gRPC stream + rollback and cost readback. Then proceed to matched baselines and failure matrix only if the first proof works.
4. Retain HTTP/WS defaults unless the trials meet the decision gates. Record the human recommendation via EmDash Admin/MCP using existing #933/#1050 capability—not a second deployment controller.
