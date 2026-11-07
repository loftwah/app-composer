# Four role journeys — 7 November 2026

Scoped [#297](https://github.com/loftwah/app-composer/issues/297) evidence. Four
first-time role journeys were exercised on the live production site: identify a
role, open its real example, then take its primary start action. The journey
stayed finite: role page → one example → one start action.

Production: Composer `bbe9e2246a853b37904ae22a55350f3d2ad3cf43` / Worker
`4c2683dd-9916-4864-aa2d-09e3c35cd164`.

## Journeys

| Role | Role page | Real example | Primary start |
| --- | --- | --- | --- |
| Creator | `/for/creator` → “App Composer for creators.” | `/demo` → “Two apps. Make the connection.” | `/init?start=showcase` → “Give your app some shape.” |
| Small business | `/for/small-business` → “App Composer for small business owners.” | `/s/fictional-trail-notes` → published Trail Notes stack | `/init/content` → “Make the fields fit the work.” |
| Developer / AI builder | `/for/developer` → “App Composer for developers and AI builders.” | `https://ready.loftwah.com` → “Hello from Loftwah.” | `/setup#new` → “Set up your project.” |
| Designer / agency | `/for/designer` → “App Composer for designers and agencies.” | Launch Kit → “Give your artwork a place to go.” | `/demo` → “Two apps. Make the connection.” |

Every role page and every resulting page returned `200`; the expected role
heading, example and start destination all matched. The receipt lists every URL
and title: `receipt.json`.

## Checks

- **Viewports:** 1440 × 1000 and 390 × 844; creator checked in dark, developer
  checked with `prefers-reduced-motion: reduce`; no horizontal overflow at any
  exercised page.
- **Console:** zero errors and zero uncaught page errors across the 14 pages.
- **Keyboard:** 12 consecutive Tab stops from `/discover` each showed a visible
  focus outline (2–3px) and a 44px-or-larger target where applicable. The first
  stops were Skip to content, the home link, More, Apps, theme, Who I am, What I
  need to do and the job rows. See `a11y.json`.
- **Semantics:** the role/discovery pages expose one `h1`, main/nav/header/footer
  landmarks, zero images without `alt`, and zero links without an accessible
  name. The chooser is a labelled navigation region.
- **No-scroll discipline:** each role page is a short, finite composition with a
  visible example and start action; it does not serialise the whole catalogue.

## Residual scope

The role journeys are live and the keyboard/ARIA semantics are inspected. Actual
screen-reader speech output and physical-device touch/zoom acceptance remain
separate general accessibility gates, as recorded elsewhere. #313 remains the
separate admin information-architecture owner.

## Evidence files

- `creator-role-1440.jpg`, `small-business-role-1440.jpg`,
  `developer-role-1440.jpg`, `designer-role-1440.jpg`
- `creator-example-1440.jpg`, `small-business-example-1440.jpg`,
  `developer-example-1440.jpg`, `designer-example-1440.jpg`
- `creator-role-390-dark.png`, `developer-role-390-reduced.png`
- `discover-keyboard-focus-390.png`
- `receipt.json`, `a11y.json`
