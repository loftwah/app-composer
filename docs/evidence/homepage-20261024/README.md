# Homepage and Init evidence — 24 October 2026

Local review captures for the task-first homepage and Init pass. They are
screenshots of the real pages rendered by the local Astro/EmDash dev server from
this branch, not generated artwork or production claims.

## Provenance

- Branch: `lane-b-homepage-20261024`, based on `origin/main` `dd4fa37100c7e5e837a0777f8435cf7c39a041ce`.
- Local server: `pnpm dev` on `http://127.0.0.1:4402` (`astro dev --host 127.0.0.1 --port 4402`, background mode).
- Browser: Playwright-controlled Chromium, viewport 1440×900, 768×1000 and
  390×844, device scale factor 1, CSS-pixel captures.
- Theme: the `composer-theme` local-storage key read by `/brand/theme-bootstrap.js`,
  set before navigation for each capture. Dark is the product default.
- Data: the local installation's own configuration and the committed fictional
  demo artwork. No production records, private briefs or owner sessions are shown.
- Capture date: 24 October 2026.

## What each file is

`baseline-*` is the page as it stood on `dd4fa371` before this branch's changes.
`after-*` is the same page after the change, from the same server and viewport.

| File | Page | Width | Theme |
| --- | --- | --- | --- |
| `baseline-{dark,light}-{1440,768,390}-fold.png` | `/` before | 1440/768/390 | both |
| `baseline-dark-{1440,390}-full.png` | `/` before, full page | 1440/390 | dark |
| `baseline-init-{dark,light}-{1440,390}-fold.png` | `/init` before | 1440/390 | both |
| `after-{dark,light}-{1440,768,390}-fold.png` | `/` after | 1440/768/390 | both |
| `after-dark-{1440,390}-full.jpg` | `/` after, full page | 1440/390 | dark |
| `after-init-{dark,light}-{1440,390}-fold.png` | `/init` after | 1440/390 | both |
| `after-init-dark-1440-full.jpg` | `/init` after, full page | 1440 | dark |
| `after-keyboard-focus-prompt.png` | `/` after, tenth Tab stop | 1440 | dark |
| `after-text200-dark-{1440,390}-fold.png` | `/` after, 32px root font | 1440/390 | dark |

Full-page captures use JPEG to keep the evidence bounded; first-viewport
captures stay PNG so text edges and focus rings are legible. Lazy images were
switched to eager and decoded before each full-page shot, because a full-page
screenshot does not wait for an image that has never entered the viewport.

## Measured change

| Measure | Before | After |
| --- | --- | --- |
| Homepage scroll height, 1440 | 6094px | 2899px |
| Homepage scroll height, 390 | 10245px | 5407px |
| Links and buttons inside `main` | 53 | 35 |
| `<h2>` sections on the homepage | 10 | 5 |
| Actions in the first viewport | 5 | 1 primary + 1 prompt shortcut |
| Prompt shortcut position, 1440 | y 512, below a brand plate | y 485, beside real screens |
| Real app screens fully above the fold, 1440 | no (thumbnails at y 642, cut) | yes (frame ends at y 832) |
| Init goal chooser, 1440 / 390 | y 784 / y 1316 | y 394 / y 624 |
| Init "Use this starting point", 1440 | below the 900px fold, under the preview column | y 767 |

The three app captures (Paperwork, Link Check, Here / there) appeared three times
on the old homepage. They now appear once in the hero, with a separate output
gallery for Launch Kit, the team films and Linkarooie.

## Checks run

- `pnpm check` — Astro 0 errors / 0 warnings / 51 pre-existing hints across 531
  files; strict model/recipe and Creator lint pass; 33 Creator files match
  formatting; 947 tests, 945 pass, 0 fail, 2 skipped.
- `pnpm build` — build complete, publication guard passed (1189 files, 125
  archive members).
- Link sweep of every `main` link on the homepage: all internal routes return
  200 except `/guestbook/`, `/showcase/` (mounted mini-app Worker services not
  running locally) and `/activity` (local D1 has no activity records). These
  links are unchanged from `dd4fa371`.
- Keyboard: skip link is the first stop; every stop exposes a 3px `#fc5b05`
  focus outline; the tenth Tab stop is the prompt shortcut
  (`after-keyboard-focus-prompt.png`).
- 200% root text (32px): `document.documentElement.scrollWidth` equals the
  viewport width at 1440 and 390, and no `main` element is wider than the
  viewport.
- Reduced motion: the shortcut's transition resolves to `none` and the page
  reports no running animations.
- Text contrast of the pairs used here: ink `#17181b` on the brand orange
  `#fc5b05` 5.61:1; muted `#afb3bb` on `#17181b` 8.44:1; muted `#5c616a` on
  `#faf9f7` 5.92:1; accent links 5.61:1 dark and 4.69:1 light.

## Not established by this folder

Production deployment and its live source identity, physical phones and
tablets, screen-reader use, real invitations or accounts, and native EmDash
administration. Owner administration returns 403 locally without trusted
Cloudflare Access, so no native EmDash journey was changed or claimed here. The
mounted `/guestbook/` and `/showcase/` routes need their own local Worker
services before their pages can be inspected.
