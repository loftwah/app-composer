---
name: woodhouse-design
description: Refine or audit a user-facing App Composer or Woodhouse surface, including motion and media. Route through the installed Impeccable skill, select relevant creative references and verify the affected journey in a browser.
---

# Woodhouse Design

Read the applicable `AGENTS.md`, product direction, design system and surface brief. Preserve approved identity, original media, publication status and accessibility. Use the [project integration guide](https://github.com/loftwah/woodhouse-new/blob/main/docs/IMPECCABLE.md) in a verified sibling checkout when inspecting or repairing tool setup.

## Work from the real surface

1. Resolve the target to its source file. Load the effective upstream Impeccable skill and run its context launcher once from the project. Record the version you actually used. Follow its documented fallback if context loading fails. Use the upstream playbook and craft floor for this job. Inspect or repair installation when setup itself is in scope.
2. Open the incumbent journey at representative sizes. Name the user action and the one or two things holding it back. For a polish pass, keep the current identity and change the smallest coherent path. For every nontrivial user-facing change, identify the user's decision and the relevant product states; retrieve only references that answer the actual UX or creative question. For familiar solved problems, inspect a working in-repo implementation first, then a relevant upstream implementation, demo and/or tests from [Design Harvest #622](https://github.com/loftwah/app-composer/issues/622), [Interaction LEGO #617](https://github.com/loftwah/app-composer/issues/617) or the owning project's references. Extract the behaviour, edge cases, evaluation and visual choices; adapt these to the existing stack rather than installing another dependency by default. For exploratory work, independently find and compare materially different working examples. Do not require the owner to supply ordinary patterns.
3. For each reference used, record its source, the specific decision it informed and its reuse terms if importing an asset. Use existing approved artwork or product captures where they can carry the experience. Treat benchmark claims, screenshots, published demos and an actual model run as different evidence. If comparing model outputs, give each the same brief and capture what it actually produced.
4. Replay the changed journey on phone and desktop. Check the relevant upstream behaviour/test scenarios and compare geometry across loading, hover, selection and content changes where dimensions should remain stable. Inspect focus, relevant empty or error states, overflow, both shipped themes when color changed, and reduced motion when motion changed. For admin, confirm the account, app and environment. For sharing, open the exact public URL and check that its credit and preview travel with it.
5. Leave a short receipt in the existing PR or issue with the skill and playbook used, the findings you fixed, the references applied and what the browser proved. Follow the repo's delivery rules for main and production. A detector result is one signal alongside the rendered journey.

## Make the product decision before choosing the component

Design includes deciding what information is useful, what action belongs here, and what happens next—not just making the chosen component attractive. Use existing user intent, permissions, real data, consequences, recovery, and comparable working products. Routine decisions are delegated; choose and implement a sensible default rather than presenting an unnecessary questionnaire.

- **Information:** what decision must the user make now? Lead with the evidence/action that supports it; move definitions, history and technical detail into appropriate drilldown. Never invent data or metrics.
- **Dialog vs page:** a short, bounded task in context can use a dialog; deep, lengthy, linkable or multi-step work usually merits a page; a nonblocking inspector can use a panel. Consult the [native dialog guidance](https://github.com/GoogleChrome/modern-web-guidance/blob/64a6d708f5a43f2cd3fde5d4d7db3905ba1bdf65/skills/modern-web-guidance/guides/ui-components/dialog.md) and applicable Radix/Floating UI examples. Verify actual keyboard, focus, dismissal and navigation.
- **Instant save vs explicit confirmation:** low-risk reversible changes can save immediately with truthful pending/saved/error feedback and recovery. Consequential, irreversible, costly, public or bulk operations need clear scope and the appropriate deliberate commit/confirmation; do not confirm routine reversible actions reflexively. Preserve existing authority and privacy.
- **Batch edits:** distinguish dirty, pending, saved, failed and conflicting items, show scope and changes, offer apply/discard/retry where appropriate, and retain edits on failure. Prove partial failures and reload/navigation behaviour.
- **Media and controls:** study working fixed-stage galleries, including [shadcn's carousel example](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/examples/carousel-demo.tsx), and existing project behaviour. Separate intrinsic media proportions from the surrounding layout; test portrait/landscape, loading, long labels, selection, keyboard and touch. Intentional responsive changes are distinct from accidental movement.

Take patterns, examples, evaluation cases and features; not an entire library, design system or dependency tree. Verify licences/notices before copying code or assets. Use native primitives or existing components when sufficient; an additional dependency requires demonstrated material benefit over those alternatives. Reuse useful upstream test scenarios and keep a concise existing issue/PR receipt of the chosen interaction, source/decision, actual observed result and remaining limitations. Do not turn routine work into a research campaign or add another approval/release gate. For an important ambiguous decision, show the strongest option with a usable preview and the meaningful trade-off; ask only where the owner's judgement actually matters.

## Public pages and headers

Name the visitor’s task before adding a tab, link, explanation or label. The first screen should let a visitor say what they can do here and recognise the next action. Put deeper provenance, implementation notes, diagnostics and release checks where someone needs them. Remove UI copy that has no visitor-facing job.

Reuse the host’s existing header, brand mark, main navigation and keyboard behavior. When a journey crosses projects, check both ends together for the same naming, destination, return path and basic interaction. Take the underlying project’s identity from its source. When moving a live page, check both its new entry and its old bookmarks in a browser.

Coverage belongs to [Woodhouse #160](https://github.com/loftwah/woodhouse-new/issues/160). Composer integration belongs to [#422](https://github.com/loftwah/app-composer/issues/422) and [#198](https://github.com/loftwah/app-composer/issues/198).
