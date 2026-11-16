# App Composer delivery train · 16 November 2026 (second session)

One continuous session. Plan and ranked pool: [docs/delivery-plan-20261116.md](../../delivery-plan-20261116.md).
Every release used the repository's own clean pushed-main guard; no new gate,
service or credential was added. Exact sources are in `/build.json` and in the
owning issues.

## Released

| Source | Release | What shipped |
| --- | --- | --- |
| `308cf7e0c6a1` | 107.4 s | `/projects` project family with integration tiers (#600); read-only GitHub command centre (#658) |
| `102e724d2917` | 106.8 s | Share approval packages and per-channel drafts (#604); pinned-replay evidence (#600/#457) |
| `4e0f28a3d488` | 107.6 s | Blind, durable benchmark review and provider-free suite packs (#601); command-centre live read fixed (#658) |

Studio releases for the same session are recorded in
[the Studio evidence note](https://github.com/loftwah/composer-media-studio/blob/main/docs/evidence/2026-11-16-train-director-gallery/README.md).

## The project family (#600)

`/projects` lists all **12** Woodhouse records by their real relationship to
Composer: **9 showcased, 3 legacy, none in the stronger tiers**. The three
stronger tiers render as explicit empty states instead of relabelled projects,
because the only Composer-built/connected apps are the reference apps and the two
blueprints rebuild those, not these records.

The `relationship` object (tier + evidence + canonical URL or null) is required
and validated; `scripts/portfolio-inventory.mjs --check` rejects missing/unknown
tiers, invented fields and duplicate canonical URLs, and runs in `pnpm build` and
`check:types`. The page is server-rendered, needs no JS, never fetches a project
at request time, and says **not recorded** where a URL, pin or blueprint is absent.
Live status is the dated inventory observation.

Evidence: `projects-1440.png`, `projects-390.png` (390 px, no horizontal overflow).

## Command centre (#658)

A read-only native-admin page at
`/_emdash/admin/plugins/composer-stacks/command-centre` reads real GitHub REST
state for three allowlisted public repos: open issues, open PRs, blocked labels,
latest release, latest commit and recent issues. Every section is `ok` or
`unknown`; counts exist only in the ok branch, so a rate limit, network failure,
404 or malformed payload can never render as zero. With a token the cache is 55 s;
without one it is 12 minutes so the 60/hour public quota is realistic, and the page
states the window. Anonymous access to the admin path still returns 302 to Access.

Not claimed: a signed-in production admin-shell look (local `/_emdash` is closed
until Access is configured), Projects v2, write actions, or token provisioning.

## Share packages (#604)

Each calendar item produces one exact approval package: destination, exact caption
with count and limit, link, share image, scheduled time in the owner's timezone with
UTC beside it, source stack/revision and provenance. It exports as plain text,
Markdown and deterministic JSON, and always states that **Composer does not post**.
Per-channel drafts cover Instagram, Facebook, LinkedIn, Bluesky (300 graphemes) and
Other, with unknown destinations shown as **not recorded**.

Two real calendar-export defects were fixed: raw `URL` values could inject CRLF
lines, and `SEQUENCE` could exceed RFC 5545's signed 32-bit range. The round-trip
test is spec-level; an Apple/Google Calendar import is still outstanding.

## Pinned source replay (#600, #457)

Media Studio at `e8b3778cd5d800378f42985afda80820fcb7ef57` was cloned fresh,
installed from its lockfile into an isolated cold store, and passed **329/329**
tests plus a 148-module frontend build. Identity was verified before and after;
the clone was deleted. The live studio (`69e120e`) is the later-change half.
Provider-funded generation and an independent owner remain unproven.

Full note: [docs/evidence/pin-replay-20261116](../pin-replay-20261116/README.md).

## A blind comparison, played live (#601)

`/benchmarks/compare` opened on **Pair 1** of the recorded `launch-page-v1` run
(3 configurations, 9 takes, 9 pairs) with no model, harness or trial identity in
the pre-vote HTML. I previewed both takes, chose **B is better**, and recorded the
reason. The server stored it as *blind when cast · reviewer visitor
(unauthenticated label)* at `2026-11-16 08:01:29 UTC`, then revealed:
Take A **GPT-5.6 Sol · Codex CLI** (45.6 s, 9/9 assertions) and Take B
**DeepSeek V4.1 Flash · OpenCode agent** (duration unknown, 9/9).

A reload kept the pair revealed with the same vote; the run page
`/benchmarks/runs/launch-page-v1-1c97c3d` shows the vote, the reason, the per-take
results and `NO RECORDED VOTE` on the other pairs; `/benchmarks/runs/…/export.json`
is the reopenable record. Votes are unauthenticated and the page says so before
and after voting; the default label is `visitor`, never "owner".

Evidence: `benchmark-blind-1440.png`, `benchmark-revealed-1440.png`,
`benchmark-run-1440.png`.

## Command centre, verified in the real admin (#658)

The first live attempt failed honestly — the page showed *"The command centre
could not be read. No GitHub state is shown as zero or complete."* The read route
returned `403 CSRF_REJECTED` without `X-EmDash-Request`, and with it returned
`{"success":true,"data":{}}` because the handler returned a raw `Response.json`
instead of a plain report for EmDash's envelope. The page now uses
`apiFetch`/`parseApiResponse`, the handler returns the plain contract object, and
a regression test covers the envelope, the missing header and the empty payload.

Live as owner `dean`: App Composer shows 155 open issues, 0 PRs, no release,
latest commit `4e0f28a`; the project switch to Media Studio shows 22 open issues,
0 PRs, release `demo-20261113`, latest commit `7949cf7`. Footer shows the
effective cache window and the live quota. 390 px: no overflow.

Evidence: `command-centre-1440.png`, `command-centre-390.png`.

## Owner play-through, end to end

1. **Composer** → `/projects` → **Fictional Trail Notes**: Creator stacks shows
   saved revision **31**, public revision **30**, one stack with two app instances.
2. **Return to the exact project** → `/s/fictional-trail-notes` serves revision 30
   with **Leave a postcard** and **See approved postcards**, plus the share card
   and QR.
3. **Prepare to share** → Share calendar: chose the published source, wrote an
   exact Instagram caption (161/2200), saved a draft, opened the **approval
   package** (source/revision, not-scheduled, link, share image with alt,
   provenance, exact caption, "not recorded" destination), copied it as plain text
   with an honest status, and downloaded the JSON/Markdown paths.
4. **Studio** → proof project → **Agent proof · three beats** → Creative Director
   changed only scene 2, revision 4 → 5, same digest in the workbench and API;
   Compare models opens on **Motion from a still** with the blind chooser; the
   public gallery gained facets and a real 16-work total.
5. **Benchmarks** → blind pair → choice → reveal → reload → run record.

Evidence: `trail-notes-public-1440.png`, `share-package-1440.png`.

## Links and states

- `/projects` and `/blueprints` are live; `/blueprints` now shows the pinned-build
  replay link and keeps the independent-owner gate explicit.
- `/benchmarks/compare` and `/benchmarks/comparisons` remain live and unchanged by
  this session's releases so far.
- `composer-home-390.png` records the mobile header after Projects joined the nav.
