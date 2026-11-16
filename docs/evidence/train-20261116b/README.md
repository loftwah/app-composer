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

## Links and states

- `/projects` and `/blueprints` are live; `/blueprints` now shows the pinned-build
  replay link and keeps the independent-owner gate explicit.
- `/benchmarks/compare` and `/benchmarks/comparisons` remain live and unchanged by
  this session's releases so far.
- `composer-home-390.png` records the mobile header after Projects joined the nav.
