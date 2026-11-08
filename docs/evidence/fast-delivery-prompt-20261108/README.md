# Five-minute routine delivery prompt — 8 November 2026

Production is Composer `896e7b1137425407203831de76666414bbbc34af`, Worker
`945a82fb-4ede-41fb-a73f-65c88c36fb9d`; `/build.json` matches. The prompt is
live at `https://composer.loftwah.com/prompts#delivery`.

## What shipped

- A new **Operations** prompt module, **Ship a routine change in five minutes**,
  with fields for the project, the change, the focused check and the guarded
  release command.
- `docs/fast-delivery.md`: the classification table, stage budget, overrun rule
  and the boundaries that stay outside the lane.
- `tests/fast-delivery-prompt.test.mjs`: three focused tests that keep the
  classification, focused-check, guarded-release and stop rules from being
  edited away.

The prompt requires one slice per window, a 45-second preflight, one focused
check, one guarded release, a five-minute stop, and an honest overrun report. It
treats a new module, migration, provider/auth/spend, multi-page UI or more than
two files as **not routine** and therefore a separate window.

## Live check

- `/prompts#delivery` returns the module with the title, `Ready to use` label and
  a 3,184-character template; the rendered text contains “five minutes”,
  “ROUTINE”, “NOT ROUTINE” and “Stop at five minutes”.
- 1440 × 1000 and 390 × 844 show no horizontal overflow. The three prompt
  actions measured 48px high.
- Clipboard access is denied in the automation browser, so **Copy template**
  showed the existing manual-copy fallback. The fallback is the correct product
  behaviour; this run did not prove clipboard success in a normal browser.
- The guard release ran the full check, build, migrations and every live gate
  and verified the exact source.

Screenshots: [`prod-1440.png`](prod-1440.png), [`prod-390.png`](prod-390.png).

## Honest timing

First edit to verified live page was approximately **6–7 minutes** (commit
`896e7b1` at 02:44:58Z; live check finished around 02:47Z). That is inside the
new contract's classification: this delivery added a new public prompt surface,
a new document and a new test file, so by its own rules it is **not routine**.
The five-minute lane is for the next one-file routine change, not for building
the prompt itself.

## What this does not prove

- A future agent will follow the prompt. The contract and the focused test make
  the rules durable; they do not enforce a stopwatch in the harness.
- The 3-minute target is not demonstrated on a routine runtime change yet.
- Clipboard success in a normal signed-in browser, physical-device and
  screen-reader acceptance were not exercised.

The next routine change should be timed explicitly and reported against this
contract.
