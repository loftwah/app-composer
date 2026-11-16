# Delivery batch — 16 November 2026

Record of what reached production in this batch, what is still open, and the next
safe step for each item. Issue receipts remain the detailed evidence.

## Confirmed source and live revisions

| Surface | Source | Live identity | How it was verified |
| --- | --- | --- | --- |
| App Composer | `6f921f2` | Worker `00e6dddc-8b2a-4005-9d38-403fa8d5fd74` | guarded release 102.3 s, all gates passed; share calendar opened in the owner session and showed real published stacks |
| App Composer | `29edc37` | Worker `62789962`-class build, release 103.6 s | `/init` serves "Curate a collection of links"; `/init/content` serves "Collection you own" |
| App Composer | `ae31256` | earlier release, 93.2 s | `/building` serves the corrected prerequisites and TL;DR |

## What changed

- **Share calendar** (#604): an owner-only surface in the native stacks admin. It
  derives items from the current published revision of a stack and its share card,
  stores `draft` / `scheduled` / `shared` locally, and offers copy caption + link,
  share-card download and a valid `.ics`. It states that it does not connect to a
  social network or confirm a post. Migration `0031_share_calendar` is additive.
- **Fresh newcomer agent evidence** (#623): a real agent using only the public site
  found that "Curate a collection" produced link cards and that there was no
  starting point for records. The option now names links, and the content model
  gained a **Collection you own** pattern (name, stage, optional 1–5 rating,
  players, notes).
- **Tutorial prompt dead end** (#489, closed): the copied `/building` prompt now
  names the clone URLs, pinned checkouts, install and Playwright acquisition steps.
  A second fresh agent got through them and stopped on an unrelated port collision.
- **Media Studio blueprint** (#600): the recipe separates what was replayed on
  16 November (fresh Worker, D1, R2, migrate, deploy, restore) from what was not.

## Still open, with the next safe step

| Issue | State | Next safe step |
| --- | --- | --- |
| #604 | Slice | A real social connection and a delivery receipt; needs account authority and an authorised recipient |
| #623 | Slice | Human first-time sessions; agent evidence is not a substitute |
| #657 | Open | Real Safari, screen reader, physical phone and human sessions for the learn surfaces |
| #601 | Open | Job-level comparisons from real Studio receipts; kept separate from the build-agent and Cloudflare inventories |
| #600 | Open | A replay from the pinned commit, with provider-funded generation and a new-account publish |
| #495 / #609 | Open | Remaining acceptance items are human-facing; the hub and first viewport have shipped |

## Notes

- No temporary resources were created in this repository's Cloudflare account by
  this batch.
- The share calendar was verified live for rendering and layout (1440 and 390, no
  horizontal overflow). Its `.ics` download and scheduling flow were verified in a
  real browser against a local dev server by the worker; the live owner session was
  used to confirm the page, the real published sources and the honest copy.
