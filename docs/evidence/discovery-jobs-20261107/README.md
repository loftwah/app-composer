# Job-led discovery — live verification

Scoped #297 delivery. The existing role discovery registry now drives seven
canonical job pages. Each page leads with the job outcome, one maintained real
example, one working action, then its related role page and honest support
context. No API, persistence, permission, dashboard, persona, stock image or
customer proof was added. The parent epic remains open.

## Release identity

| Item | Value |
| --- | --- |
| Source | `5ee5574b10b3c7b62ede8b3451b382a7fc9180ad` |
| Worker version | `22777f11-e72b-4520-b99c-e186bf1dd01c` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | `5ee5574b10b3c7b62ede8b3451b382a7fc9180ad` |
| Stack status | deployed source `5ee5574b10b3`, snapshot 7 Nov 2026 03:52 UTC |
| Retained suite | 457 passed, 0 failed, 0 skipped |
| Publication guard | 1,292 files and 150 archive members inspected |

`pnpm deploy` ran the required `pnpm check` and `pnpm build` once before remote
mutations. Its live source, pinned services, sharing output, publication privacy
and anonymous administration boundary gates passed. The full suite was then
re-run with `GIT_CONFIG_GLOBAL=/dev/null` after the host's SSH commit-signing
lookup began failing (`No user exists for uid 501`); the 457-pass result above is
that rerun. No assertion was removed.

## What changed

- `/discover` now has two finite choosers: **Who I am** (seven roles) and **What
  I need to do** (seven jobs). The old hub rendered the Creator page as its
  opening content; it now names all seven roles and all seven jobs in its
  metadata and lists both sets directly.
- `/jobs/{profile,enquiries,first-app,branding,diagram,pdf,inspect}` is the
  canonical, indexable job URL set. Every path is in the sitemap and every job
  page has a self-canonical URL, title, description and existing share image.
- Role pages keep all seven `/for/{role}` routes, content, examples, actions and
  job picker. They add the same **Who I am / What I need to do / All roles and
  jobs** switch.
- Old job links are not broken: `/for/{role}?job={id}` returns a `308` to
  `/jobs/{id}` only when the job belongs to that role. A mismatched job query is
  ignored, so `/for/creator?job=pdf` still renders the Creator page.
- The job registry now carries the plain outcome, meta description, example,
  action, related roles, support note and share image. The four role-linked jobs
  reuse the existing role example and an existing role action; the three tool
  jobs reuse the existing app capture and working destination.

## The seven jobs

| Job | Canonical | Real example | Working action |
| --- | --- | --- | --- |
| Make my public page | `/jobs/profile` | Loftwah’s published Linkarooie profile | `/init?start=showcase` |
| Collect private enquiries | `/jobs/enquiries` | Published Fictional Trail Notes stack | `/init/content` |
| Build or change an app | `/jobs/first-app` | Hello World at `ready.loftwah.com` | `/setup#new` |
| Make branded assets | `/jobs/branding` | Deployed Launch Kit editor | `https://composer-launch-kit.loftwah.workers.dev` |
| Draw an editable diagram | `/jobs/diagram` | Deployed LDraw workspace | `https://ldraw.loftwah.com/` |
| Fill or sign a PDF | `/jobs/pdf` | Deployed Paperwork editor and fictional form | `https://paperwork.loftwah.com/?sample=garden` |
| Check a website before sharing | `/jobs/inspect` | Deployed Link Check inspection form | `https://share.loftwah.com` |

All seven had a truthful existing destination, so none was deferred. No new
demo, API or capability was invented to make a job fit.

## Anonymous live checks

Executed without a session cookie, using the resolved Cloudflare address to
avoid the host DNS fault during the check. Raw result:
[`anonymous.json`](anonymous.json).

- All 15 public routes (`/discover`, seven jobs, seven roles) returned `200`.
- `/build.json` returned source `5ee5574b10b3c7b62ede8b3451b382a7fc9180ad`.
- `/for/small-business?job=enquiries` returned `308` with
  `Location: /jobs/enquiries`.
- `/jobs/not-a-job` returned `404`.
- All seven `/jobs/...` URLs are present in `sitemap.xml`.
- Every job action and example destination returned `200`:
  Launch Kit, LDraw, Paperwork sample, Link Check, Hello, the Linkarooie profile
  and Fictional Trail Notes. Raw result: [`external.json`](external.json).

## Live measurements

Measured at 390×844 and 1440×1000 in both themes, in the authenticated owner
session before the capture tool disconnected. Positions are viewport pixels from
the top. Every one of the 60 route/viewport/theme runs reported
`scrollWidth == clientWidth` (390/390 or 1440/1440), so there is no horizontal
overflow. Full data: [`metrics.json`](metrics.json).

### Job pages — mobile 390×844

The outcome and the one action are in the first viewport on every job page.
Theme does not change the layout.

| Job | H1 | Switch | Outcome | Action | Example | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| profile | 116 | 202→310 | 380→454 | 598→646 | 769→983 | none |
| enquiries | 116 | 202→310 | 380→454 | 598→646 | 769→983 | none |
| first-app | 116 | 202→310 | 380→454 | 598→646 | 769→983 | none |
| branding | 116 | 202→310 | 380→491 | 609→657 | 779→993 | none |
| diagram | 116 | 202→310 | 380→454 | 571→619 | 742→956 | none |
| pdf | 116 | 202→310 | 380→454 | 571→619 | 742→956 | none |
| inspect | 116 | 202→310 | 380→454 | 571→619 | 742→956 | none |

The example begins at 742–779, so its top is visible in the initial 844px
viewport. The action is at 571–657, well above the fold.

### Job pages — desktop 1440×1000

| Job | H1 | Switch | Outcome | Action | Example | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| profile | 158 | 246→298 | 382→494 | 616→664 | 352→752 | none |
| enquiries | 158 | 246→298 | 382→494 | 616→664 | 352→752 | none |
| first-app | 158 | 246→298 | 382→494 | 616→664 | 352→752 | none |
| branding | 158 | 246→298 | 382→550 | 672→720 | 352→752 | none |
| diagram | 158 | 246→298 | 382→494 | 616→664 | 352→752 | none |
| pdf | 158 | 246→298 | 382→494 | 588→636 | 352→752 | none |
| inspect | 158 | 246→298 | 382→494 | 616→664 | 352→752 | none |

### Hub and role pages

- Hub at 390: H1 112→181, switch 326→382, job section 398, first job row
  492→558, role section 1058. Hub at 1440: H1 158→276, switch 323→375, job
  heading 397, first job row 510→584, role column starts at the same row.
- Role pages at 1440 keep the existing result and actions in the first viewport:
  role actions sit at 860–918, examples at 591–951. At 390 the role headline
  begins at 725–749 after the role navigation; the existing role action follows
  at 917–1004. That is the retained role-page composition, not a new job page.
- Keyboard focus: every job and role run reported the same visible ring after a
  keyboard `Tab` and focus on the primary action:
  `rgb(252, 91, 5) solid 3px`, offset `4px`, in both themes.
- Reduced motion: the release-candidate browser reported zero active animations,
  zero non-zero transitions and `scroll-behavior: auto` under
  `prefers-reduced-motion: reduce`. The deployed CSS is byte-identical to the
  tested build: [`css-match.json`](css-match.json) confirms
  `Base.C9mO9m21.css` and `_job_.DyXwdgRW.css` hashes and the reduced-motion
  rule. The new components declare no animation or transition of their own.

## Captures and capture residual

23 live captures are retained where the example image had painted:

- Hub: [390 dark](hub-discover-390-dark.png) ·
  [390 light](hub-discover-390-light.png) ·
  [1440 dark](hub-discover-1440-dark.png) ·
  [1440 light](hub-discover-1440-light.png)
- Jobs: [diagram 390 dark](job-diagram-390-dark.png) ·
  [inspect 390 dark](job-inspect-390-dark.png) ·
  [enquiries 390 light](job-enquiries-390-light.png) ·
  [branding 390 light](job-branding-390-light.png) ·
  [diagram 390 light](job-diagram-390-light.png) ·
  [pdf 390 light](job-pdf-390-light.png) ·
  [inspect 390 light](job-inspect-390-light.png) ·
  [enquiries 1440 dark](job-enquiries-1440-dark.png) ·
  [first-app 1440 dark](job-first-app-1440-dark.png) ·
  [branding 1440 dark](job-branding-1440-dark.png) ·
  [diagram 1440 dark](job-diagram-1440-dark.png) ·
  [pdf 1440 dark](job-pdf-1440-dark.png) ·
  [inspect 1440 dark](job-inspect-1440-dark.png) ·
  [enquiries 1440 light](job-enquiries-1440-light.png) ·
  [first-app 1440 light](job-first-app-1440-light.png) ·
  [branding 1440 light](job-branding-1440-light.png) ·
  [diagram 1440 light](job-diagram-1440-light.png)
- Role: [small business 1440 dark](role-small-business-1440-dark.png) ·
  [small business 1440 light](role-small-business-1440-light.png)

**Capture residual.** The Playwright extension disconnected after the
measurement pass. In the remaining route/theme combinations the screenshot
caught the example panel before first paint, even though the same run reported
the image `complete: true` with its real natural dimensions. Those PNGs were
removed rather than kept as misleading evidence. The DOM measurements, image
natural dimensions, action destinations, focus outlines, overflow checks,
anonymous HTTP checks, sitemap and external destinations remain recorded above.
The capture tool could not be reconnected; this is a capture-layer gap, not a
page failure.

No page was saved, published, submitted or mutated. No private enquiry, order,
stack or customer record was opened. This is not physical-device, screen-reader,
browser-zoom or every-role/task acceptance. It does not close #297, #313, #321 or
#412. Guestbook's declaration release and composition promotion remain at the
recorded checkout/token gate.
