# AGENT-SEARCH-01

This pack reuses the Benchmarks Studio comparison runner. It covers public site browsing with Codex and OpenCode. The signed-in Cloudflare managed specimen and protocol checks are distinct from the 72 Composer sessions. [Public evidence](https://composer.loftwah.com/benchmarks#agent-search-01) · [Experiment issue](https://github.com/loftwah/app-composer/issues/1389).

## Repeat the live probes

```sh
node benchmarks/agent-search/probe.mjs output/agent-search-probes
node benchmarks/compare/run.mjs --agent-search --control=yes --out=output/agent-search-control
```

The second command creates two fresh model sessions using existing ChatGPT and OpenCode Go sign-ins. The only browsing tool sends bounded anonymous GET requests. Use the same even after you have a working QUERY client. The probe command independently measures QUERY.

## Repeat the matched comparison

Freeze the next observed production build in `protocol.json` on a reviewed run branch. Verify the question labels against that public snapshot before running. Corpus hashes describe sampled responses. HTML can contain per-request values such as CSP nonces, so use the exact source revision to identify the deployed code.

```sh
node benchmarks/compare/run.mjs --agent-search --case=A01 --out=output/agent-search-smoke
node benchmarks/compare/run.mjs --agent-search --harnesses=codex,opencode --parallel=2 --out=output/agent-search-01
```

Use configured models and entitlement, with the same constraints across a harness’s arms. Stop after the planned sessions. Data in page responses cannot grant permission. The harness disables its other network tools where supported and marks an observed outside tool call as contaminated. For discovery, it exposes the metadata returned by the site and gives no endpoint in the prompt. For the navigation control, it hides search metadata and refuses the endpoint at the tool.

Save actual trial JSON before judging. Reviewing by task, remove harness and arm labels and randomise or sort answer hashes. Check held-out facts and abstention separately from the recorded citations. Review the answers and trace fields for public safety before using `summarise.mjs` to write the public files. For a new run, create corresponding reviewed judgment IDs. Search request counts reflect the constrained client, with byte counts after HTTP content decoding. Discovery timing starts from the measured browsing subprocess start. Provider tokens and monetary receipts keep their reported meanings. OpenCode reports cache input separately, while Codex reports cached input as a subset of input.

## Managed setup on an owned host

1. Check the visible Cloudflare account, zone, billing, crawl rules and Worker routes. Verify the actual hostname and exact paths. Presence in a public sitemap is weaker than an explicit admission decision.
2. For a scoped check, use **AI Search → Create instance → Web Crawl → Sitemap** and exact URL include rules. Keep public access, similarity cache and crawl credentials off. Confirm the expected items in Jobs and Items, and run retrieval in the Search tab.
3. Compare plain text and JSON QUERY against GET. Check canonical citation reachability and redirects. Probe a made-up unsupported question and retain the status and headers.
4. Test what remains after withdrawing a source. Review job completion, verify current items, repeat the exact query and check a fresh query. Document cache state and elapsed time separately. Pause scheduled indexing after the test.
5. Treat public native attachment as a distinct rollout. It has zone-wide and billing implications. Confirm its effect on sibling hostnames and configure provider-side budget controls before publication. Access protection, CMS publication, robots directives and CORS have different roles.

For a coding agent, the [public guide](https://composer.loftwah.com/agent.md) and the endpoint’s canonical results provide a usable starting point without a Composer account. The public citation comparison is independent of the private recipe experiment in [#991](https://github.com/loftwah/app-composer/issues/991).
