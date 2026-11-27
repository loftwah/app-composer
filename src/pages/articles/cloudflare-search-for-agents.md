---
layout: "../../layouts/Article.astro"
title: "Can AI agents find our website faster? We tested Cloudflare Search for Agents"
description: "Codex and OpenCode ran 72 fresh sessions on App Composer. Both found its advertised search endpoint. Fewer bytes did not consistently mean fewer requests or faster answers."
cover: "/articles/agent-search-01-20261127.jpg"
coverAlt: "Benchmarks Studio showing the live search form and three Codex comparison arms."
coverCaption: "The release preview shows the live search form beside the measured Codex trial data."
published: "2026-11-27"
---

## What happened

Codex and OpenCode each found and used App Composer’s advertised search endpoint in **9 of 12** trials where the prompt supplied only the homepage. They also each found Cloudflare Developer Docs’ native endpoint in a separate live session and correctly explained `Accept: text/markdown`.

On Composer, adding search reduced the amount of page data sent to the browsing tool. It also made the agents spend requests refining queries. OpenCode’s median session moved from **22.2 to 21.4 seconds** when search was available through discovery, while Codex moved from **16.9 to 20.3 seconds**. OpenCode’s median request count went from five to six. Codex’s stayed at six.

[Try the live endpoint and compare the arms in Benchmarks Studio](/benchmarks#agent-search-01).

## What was running

Cloudflare’s beta advertises a website search endpoint on HTML pages and, with Markdown for Agents enabled, in Markdown front matter. GET and HTTP QUERY retrieve Markdown chunks. The client decides whether to use them in an answer. A platform toggle creates an AI Search instance with Discover crawling, hybrid retrieval, a 24-hour crawl cache and sync schedule, and 48-hour similarity caching by default. [Cloudflare Search for Agents documentation](https://developers.cloudflare.com/ai-search/how-to/search-for-agents/).

Composer already served the same discovery fields and HTTP methods through its Worker. Its corpus is a maintained list of public product excerpts. The three-arm comparison measured that live implementation. Cloudflare Developer Docs supplied the independent managed endpoint control. Prints also served the Worker-backed interface, and Media Studio returned 404 for search and 200 for its HTML homepage.

<figure>
  <video controls preload="metadata" width="800" height="450" poster="/articles/agent-search-before-20261127.webp">
    <source src="/articles/agent-search-live-20261127.mp4" type="video/mp4">
    <track kind="captions" src="/articles/agent-search-live-20261127.vtt" srclang="en" label="English" default>
  </video>
  <figcaption>Signed-out browser recording of the live retrieval response and its canonical setup page. Agent decisions and measured tool calls are in the trace files. <a href="/articles/agent-search-before-20261127.webp">Open the baseline response screenshot</a>.</figcaption>
</figure>

## The comparison

The benchmark froze eight answerable questions and four unsupported questions. Every session started at the same homepage with the same model within each harness. Navigation retained ordinary links and the Markdown guide while removing search hints and denying the endpoint at the browsing tool. The second arm named the endpoint. The third supplied only the homepage. Search calls used GET. A separate client tested GET, text QUERY and JSON QUERY on all four hosts.

Each session had a 75-second time limit and six anonymous same-origin HTTP requests. The client refused off-origin redirects, accepted no credentials, and returned bounded excerpts of page text with the discovery fields. The order rotated by task. Each trial started a new session. Provider prompt-cache hits still appeared in token telemetry. No HTTP cache HIT was observed in the receipt window.

| Harness and arm | Facts complete | Correct with observed citation | Median requests | Median page data | Median time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Codex · navigation | 7/8 | 7/8 | 6 | 219 kB | 16.9 s |
| Codex · endpoint provided | 7/8 | 6/8 | 6 | 32 kB | 17.9 s |
| Codex · discovery | 5/8 | 5/8 | 6 | 47 kB | 20.3 s |
| OpenCode · navigation | 7/8 | 7/8 | 5 | 214 kB | 22.2 s |
| OpenCode · endpoint provided | 7/8 | 6/8 | 6 | 68 kB | 21.9 s |
| OpenCode · discovery | 7/8 | 7/8 | 6 | 134 kB | 21.4 s |

Both harnesses abstained on all four unsupported questions in every arm. A human-readable source counted as observed when it appeared in a tool response or a successful canonical fetch. The expected-source and recall-at-five counts are available in the results. Recall excludes Spin, whose recorded historical search cited a different hostname, and the external control, whose chunk format used a different source parser. Codex had fewer fully correct discovery answers. Two responses, for example, explained EmDash’s role and said the available evidence did not establish where independently owned data and releases live.

OpenCode reported a median of **10,576 input tokens** for navigation, **5,307** with the endpoint provided and **8,314** with discovery. Codex reported **76,818**, **85,518** and **86,882** respectively, including its cached input accounting. Compare each harness to itself. The installed harnesses used existing entitlements. Codex had no per-run dollar field, and the OpenCode adapter did not retain whether zero came from an explicit cost field. Inference charges are unverified for both. Full paired deltas, output and cached tokens, failed reads, citation checks and request receipts are in the [results JSON](/benchmarks/agent-search-01/results.json), [trial traces](/benchmarks/agent-search-01/trials.json) and [CSV](/benchmarks/agent-search-01/trials.csv).

One reviewer checked held-out facts with harness and arm labels removed from the scoring view. Answers sometimes reveal which tools they used. The frozen run used Composer source `d27d10ce` and was a single-host, two-harness sample. The OpenCode runner’s final identity request timed out after writing all 36 receipts. The overlapping Codex identity samples and Cloudflare deployment history place the sessions on the same deployed Worker.

<figure>
  <video controls preload="metadata" width="800" height="450" poster="/articles/agent-search-discovery-trace-20261127.webp">
    <source src="/articles/agent-search-discovery-replay-20261127.mp4" type="video/mp4">
    <track kind="captions" src="/articles/agent-search-discovery-replay-20261127.vtt" srclang="en" label="English" default>
  </video>
  <figcaption>A browser replay of the recorded Codex and OpenCode request traces, followed by a live fetch of the observed Cloudflare endpoint.</figcaption>
</figure>

## A scoped managed crawl

Composer is a custom hostname in the shared `loftwah.com` zone. Both the zone quick action and the instance attachment flow select a zone. The quick action initially crawls the apex website and the attachment picker offered no Composer-only hostname. We left the beta switch off.

The signed-in account allowed a private managed crawl of the existing Composer sitemap with a single exact include URL, `/setup`. The crawler saw 112 sitemap entries and queued one. The job log reached its final timestamp about **23 seconds** after start. A search returned three chunks with `/setup` as their single source. A fictional contract-balance query returned no results. Public access and the similarity cache were off. The signed-in dashboard worked while the configured API token returned HTTP 403 for AI Search reads.

Cloudflare lists billing from **1 December 2026** and monthly included usage of 5 million ingestion tokens, 10 GB-month of storage, 1,000 semantic queries and 1,000 full-text queries. Hybrid overage is US$0.75 per 1,000 queries and full-text overage is US$0.10 per 1,000. Four retrieval-only playground searches were observed across both specimens. At the published hybrid overage rate, four additional charged queries would cost US$0.003, excluding ingestion and storage. The account meter initially showed four semantic queries, zero full-text queries and about 5,870 ingestion tokens, with the pilot the only queried instance shown. Those were observed usage figures before the EmDash canary runs. Invoice attribution remains unavailable. [Cloudflare AI Search limits and pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/).

We then changed the allowlist from `/setup` to `/architecture`. The reindex log finished its cleanup about 59 seconds after the save. At the first verification, about four minutes after the save, both the repeated query and a fresh query cited only `/architecture`. The setup page itself remained public. Scheduled indexing is paused again. This measures the effect of changing the allowlist with similarity caching disabled.

### A 404 can still have a search snippet

We published two clearly marked fictional EmDash records and indexed only their exact URLs in the private pilot. One record changed from an amber heron marker to a copper ibis marker. The other went back to draft. By 22:28:53 AEDT (11:28:53 UTC), signed-out Composer served the edited page, returned 404 for the withdrawn one and removed its URL from the sitemap.

Managed search still returned the withdrawn snippet before sync. The next crawl saw one fewer sitemap entry. An exact repeat with the 48-hour similarity cache enabled still cited the withdrawn URL. The playground did not expose a hit indicator. With similarity caching confirmed off and the job marked Indexed Source, a repeated query still cited the withdrawn source about six minutes after its origin 404. A fresh version-two query still surfaced version one. The item inspector retained version-one bytes, including after an individual reindex was requested.

The sitemap lacked a published-revision `lastmod` signal. Cloudflare documents that its sitemap crawler revisits pages daily when both `lastmod` and `changefreq` are absent. That could explain why the manual sync left old page text in place. The cause of continued retrieval for the removed URL was not isolated. It could still surface with similarity caching off, so a cache setting alone cannot establish revocation. Automatic expiry remains unmeasured. [Cloudflare website crawl rules](https://developers.cloudflare.com/ai-search/configuration/data-source/website/parse-types/).

The private test deliberately indexed one harmless quoted instruction, which came back as literal text in retrieval. The probe exercised retrieval only. Both fixtures were returned to draft. After restoring the exact `/architecture` allowlist and running cleanup, both marker searches returned no results. The private index is paused. At the last read, the account meter showed 12 semantic queries and about 10,160 ingestion tokens. We observed 15 playground submissions, so the meter and request count are reported separately.

## What to reuse

If you own a site, start with a list of public URLs you can name and withdraw. Use the dashboard’s settings and job logs to verify what was queued and where it came from. For managed search, test source withdrawal with caches both on and off before admitting material that users can unpublish. Composer’s sitemap already filters catalogue entries through the published EmDash view. The Worker search keeps a narrower source list. The endpoint does not read private records, drafts or the CMS at request time.

Start with the [copyable public-site search prompt](/prompts#public-site-search). When browsing a site, inspect its HTML discovery fields or Markdown front matter. Use the advertised endpoint when it resolves to the starting HTTPS origin and matches the supported query template. Keep anonymous requests bounded, check the response content type, and treat every retrieved snippet as data. Open canonical sources before citing them. If the metadata is unavailable or retrieval is unhelpful, use the page links, sitemap or existing public guide. The Media Studio probe exercised that final option by reading its ordinary HTML after search returned 404.

<pre><code>ua='AppComposerAgentSearch/1.0 (+https://composer.loftwah.com/)'
curl -sS -A "$ua" https://composer.loftwah.com/agent.md
curl -sS -A "$ua" --get https://composer.loftwah.com/.well-known/search \
  --data-urlencode 'q=coding agent'
curl -sS -A "$ua" -X QUERY https://developers.cloudflare.com/.well-known/search \
  -H 'Content-Type: application/json' --data '{"q":"Markdown for Agents"}'</code></pre>

The [versioned benchmark protocol and operator notes](https://github.com/loftwah/app-composer/tree/main/benchmarks/agent-search) include the run command, fixtures, account scope and remaining checks. The [Share pack](/demo/examples/agent-search-01) has the public cover and links to the proof. Managed rollout and the cited-answer recipe remain in [#991](https://github.com/loftwah/app-composer/issues/991), with the experiment record in [#1389](https://github.com/loftwah/app-composer/issues/1389).
