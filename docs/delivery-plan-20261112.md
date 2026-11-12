# App Composer delivery plan · 12 November 2026 AEDT

Start with a public analytics page worth exploring, then make the same chart interactions useful in the owner’s workspace. Use the existing Creator Hub to show a follow-up change from brief to published app. Alongside those releases, finish small, demonstrable issues where the remaining acceptance can be exercised on the actual product.

## Baseline

- GitHub showed **114 open issues and zero open PRs**. Local and remote `main` and the live Composer [build identity](https://composer.loftwah.com/build.json) matched `1de81f74cfdafc8789ad9800311c17bb27b200cb`. Recheck at kickoff. [Open issues](https://github.com/loftwah/app-composer/issues?q=is%3Aissue%20is%3Aopen)
- Read-only live requests returned 200 for [Activity](https://composer.loftwah.com/activity), its [30-day composed view](https://composer.loftwah.com/activity?days=30&surface=composed), the [Link Check record](https://composer.loftwah.com/activity/linkcheck), a [frozen report](https://composer.loftwah.com/reports/r971f5140bbe0c84c8147a64b), [Creator Hub](https://composer.loftwah.com/creator-hub), its [share board](https://composer.loftwah.com/creator-hub/share), [Collections](https://composer.loftwah.com/collections), [Prompts](https://composer.loftwah.com/prompts) and [Launch Kit](https://composer.loftwah.com/launch-kit). The Activity response puts findings before the main chart. The existing [public and native analytics captures](evidence/analytics-213-20261107/README.md) were inspected for layout. The native screen’s current authenticated behaviour still needs verification during implementation.
- `ready.loftwah.com` reported Hello source `6411500a39f53d86a61bf4d3efd36f0db94331c7`. `share.loftwah.com` reported Link Check source `99c204ab370a37eab90e6a4e0024506afb0f4a32`. These were identity reads.
- #213 (analytics showcase), #297 (role discovery), #313 (task-first UX), #398/#399 (sitemap/mini-app SEO inventory), #412 (capability discovery) and #427 (maintenance pass) are closed foundations. #50, #273, #286 and #292 are also closed. Start from their working surfaces and recorded limits. Use [#11](https://github.com/loftwah/app-composer/issues/11) for the next release receipts.

## Release sequence

| Order | Release | What someone can try | Issue outcome |
| --- | --- | --- | --- |
| 1 | Public Activity and app records | Switch 7/30 days and route, select a metric, inspect a day, drill into an app and preview a shareable story. | Visible progress on #7/#30, evidence in #11. Carry forward #213’s existing contracts. |
| 2 | Private Analytics & outcomes | Open a saved stack, switch signals, inspect a day and export the displayed scope. | #116 presentation and evidence slice. Full closure depends on recording and isolation acceptance. |
| 3 | Creator Hub follow-up change | Start from the live case study, adapt the same reference app, inspect the resulting native workflow and see the change at its live URL. | #425 flagship slice. Advance #24/#25 and #114/#115 where the same run proves their acceptance. |
| 4 | Finish proven small outcomes | Keep and customise the Hello starter, export a usable Launch Kit package, complete a Brand Studio transformation or finish one of the other closure candidates below. | Ship each executable row. Close only issues whose full current acceptance is evidenced. |
| 5 | Carry a maintenance task from setup into real use | Select **Check my app for problems** or **Check that my changes are live**, inspect the handoff and use it on the chosen app. | #428 setup and manual handoff slice. Connected execution and recurrence retain #311/#289 ownership. |

Move an independent closure candidate forward when it can ship while another release waits on Access, a device or a consenting participant. Keep a single integration writer. The order prioritises the owner’s request for visibly better charts, then reuses the resulting surfaces and evidence.

## 1 · Public Activity

### Direction

Make the first viewport answer **what happened in this period?** Use a compact title, a scope strip and one generous chart. Existing Composer charcoal/ivory, Space typography and orange action roles carry the identity. Use the existing app marks in the breakdown where they aid recognition. On phones, stack the scope, chart and day readout, then the app breakdown. The chart should feel lively through immediate, direct response to an action. Highlight a selected day and update its label in place. Keep transitions short and optional with reduced motion.

```text
App activity                           [7 days / 30 days] [All routes]
App opens  |  Completed inspections  |  Postcards received   (examples)

                Daily count plot                    Selected day · UTC
          bars, zero marks, gaps, coverage           Value and coverage
                                                   Previous day / Next day
                               View daily values

App breakdown  →  open the same period and route in the app record
Recorded findings  →  inspect evidence  →  preview a shareable report
```

The wireframe shows layout and sample labels. Populate the selector from the existing supported signals and keep the active metric definition beside the chart. Put the four incumbent summary values where they help orient the reader. Give the plot priority over methodology, decorative numbering and a long hero. Keep **what was recorded**, **where** and **when** visible in plain language.

### Implementation seams

1. Start with `src/pages/activity.astro`, `src/pages/activity/[app].astro`, `src/components/ActivityHistory.astro`, `src/components/AnalyticsTrend.astro`, `src/browser/activity.ts`, `src/styles/{activity,analytics}.css` and `src/lib/activity-view.ts`. The overview already supports native GET filters, a chart-only metric picker, pointer inspection and a value table. Bring the app record to the same day-inspection standard. Reuse a small chart formatter or interaction only where both callers have the same semantics. Keep SVG geometry and existing styles compatible with CSP.
2. Keep `days`, `surface` and `metric` coherent across reload, app drilldown, return and report preview. Make a busiest-day finding select its exact UTC day through an allowlisted, validated day parameter. Keep bad or out-of-window values recoverable. One day cursor powers mouse inspection, deliberate tap, native keyboard range/step controls and a pinned text readout. A phone user can scroll past the chart without dragging it. Preserve no-script forms and the value table. Give keyboard users one straightforward way to inspect the whole series.
3. Keep the source data grounded in `lib/usage/index.mjs` and `lib/usage/portfolio.mjs`. The overview currently falls back to synthetic zero rows for app comparison when its totals read fails, and substitutes zero for some failed route totals before building findings. Reproduce the independently failing-read cases and trace any existing guards before editing. Render genuinely unavailable readings as unavailable. Suppress a route-share finding if its inputs are incomplete. Preserve available sections in a partial outage.
4. Draw a retained zero on the baseline, leave a marked gap for missing history and distinguish today/partial days and capped lower bounds with shape and text. Keep apps without a composed route separate from measured values. Rank only like measures within the same scope. Use descriptive findings based on the actual data. Preserve the existing report preview, allowlisted public snapshot and landscape/square/portrait renderers in `src/pages/reports/`, `src/pages/api/reports.ts` and `src/lib/public-report.ts`. Keep old report IDs and frozen values usable. No analytics vendor or new collector is needed for this release.

### Acceptance

- In the live browser, open Activity, change both filters, inspect an actual day, open a supported app, reload its scoped URL and reach the matching report preview. Exercise the Link Check composed-scope explanation and its standalone recovery link. Read an existing frozen report and verify its supported image links. If production verification creates a new public snapshot, use only an authorised public aggregate, preferably reuse a matching snapshot, and record the actual URL.
- Check representative desktop and phone layouts in both themes, keyboard and reduced motion, plus no-script Activity. Use a small bounded fixture or existing evidence for known zero, missing, partial, capped, unsupported and failed read. Check scope parity among plot, readout and table. The release is visibly better if someone can inspect a recorded day directly from the first screen. Capture that interaction in the released UI.

## 2 · Native EmDash Analytics & outcomes

- Work in `src/plugins/outcomes.tsx`, `src/plugins/outcomes.css`, `src/plugins/outcomes/{api,protocol}.ts` and the private report owner `src/lib/private-outcomes.ts`. Keep the current app shell and membership checks. Lead with the applied workspace/stack/instance/traffic/date range, then the chart and day readout. Put export next to the applied scope, and place definitions, previous window and target breakdown where they can explain the chart. Carry over the useful day selection language and visual treatment from public Activity. Read the actual report schema before deciding which marks each signal can support.
- Make pending filters and the last successful report unmistakable. A failed refresh can leave the last successful result visible with its scope and status. Exports use that displayed scope and are queried again, so identify their actual timestamp. Keep demo and unclassified traffic explicit. Show percentage change only when the existing data contract supports it. Explain absence, retention, partial observation and snapshots in the selected signal. Preserve the native table.
- Preserve the existing owner-only, selected-stack-and-instance Open-action aggregate publication path, exact preview and explicit consent. `docs/private-outcomes.md` predates some of this code. Check current server handlers and protocol before relying on old notes. Keep workspace names, identifiers, app record text and other private dimensions outside public output. Maintain classification, authorization, retention and collector behaviour across the presentation release.
- Exercise a controlled authorised demo in the protected admin. Prove stack/instance/date selection, actual keyboard/day interaction, report/export scope and denied cross-workspace read or selector. Keep private evidence in its existing protected location. If Access is unavailable, local verification is useful and the native live gate stays pending. #116 also requires a two-stack real event-to-report proof, committed-success and duplicate handling, retention/deletion checks, and supported link/conversion semantics. Finish those in their own bounded slice if a concrete eligible event and complete evidence are available. Document unavailable events without inferring conversion from opens.

## 3 · Creator Hub follow-up

The [live Creator Hub](https://composer.loftwah.com/creator-hub), sample draft, native **Manage mini-apps** deployment selector, approval/feature/hide proof, [share board](https://composer.loftwah.com/creator-hub/share) and walkthrough are already present. Use the existing sample and latest [#425 acceptance](https://github.com/loftwah/app-composer/issues/425). The current reference uses the operator’s account. See [native administration evidence](evidence/creator-hub-native-admin-20261112/README.md) and [release history](STATUS.md).

1. Use one concrete follow-up brief on the same fictional creator app. Suggested task: **“Give my curated links more prominence while keeping my approved postcards available.”** Verify whether the real Linkarooie schema can express it. Show the existing result and a preview carrying the creator’s accepted reference choices. Use a supported layout or ordering change that can be seen on the public result and reversed. If the schema lacks the setting, add only the smallest useful change through its existing app-owned configuration path.
2. Keep the chosen reference, intent, source pin and permissions in the actual Init/spec/handoff. Exercise save/reopen/import and review before replacing a draft. Use the normal authorized native controls and trusted agent/release path. Show the same fictional app before and after at the real target, with existing links, content and unpublished/revoked media correctly preserved. An independent source change needs that app’s own release and live verification, then Composer promotion where applicable.
3. In the authorised reference or isolated fixture, exercise a compatible source update, a refused incompatible candidate and a safe return to the prior known-good presentation. Prove current visibility survives. Keep data restore claims scoped to demonstrated data/media. Include deletion only with explicit authority for the disposable fixture. Refresh the existing case study with actual source and one clear follow-up sequence. Reuse the current recording/board if their claims and footage still apply.
4. Put the outstanding gates on #425 and their owning issues. A consenting newcomer in their own authorised environment, the full newcomer setup, approved Cloudflare Dashboard extension evidence and the relevant opt-in Oyster capability still matter to the flagship. Work on available pieces without making them prerequisites for a finished analytics release. The sample should let a new visitor go from the live example to an inspectable draft.

## 4 · Closure candidates and other visible work

Start with acceptance reconciliation on these candidates. Read the body and owner comments, compare current exact-source evidence and perform the smallest missing real workflow. Reuse one proof across issues when it genuinely covers the requirement. Each row has a tangible endpoint. #11 and umbrella issues continue as evidence/coordination owners.

| Candidate | Action and proof | Closure decision |
| --- | --- | --- |
| [#18](https://github.com/loftwah/app-composer/issues/18) Hello reference | Use the existing Hello starter in the supported pre-idea flow on an authorised isolated target. Retain a copy via Init, change one visible value, release and read it back over HTTPS. | Strong candidate if a real agent/account and target are available. Include real source, retry semantics, indexing and cleanup. The operator’s current live Hello alone covers the reference baseline. |
| [#193](https://github.com/loftwah/app-composer/issues/193) Launch Kit | Make a browser-local asset package with the approved fictional artwork. Inspect 16/32/48px, maskable icons, and a real-size share preview. Use the package in an existing supported reference and verify the output after its real release. Reuse the independent renderer and existing adopter. | Close with the full local-to-deployed package evidence and the relevant Composer/Link Check path or recorded follow-up allowed by the issue. Keep #246’s optional artwork adapter separate. |
| [#403](https://github.com/loftwah/app-composer/issues/403) Brand Studio | Use existing `src/plugins/brand-studio-page.tsx` and [Brand Studio contract](brand-studio.md). Show before/after on supported native screens and complete preview → save → publish → verify → restore on a permitted fictional target. Review the same scenario in both themes and at both sizes. | Candidate after native transformation and restore are actually evidenced. The previous production receipt covers unsaved preview/review/cancel. #353 has broader cross-app/admin/consumer scope and stays open unless that scope is separately met. |
| [#177](https://github.com/loftwah/app-composer/issues/177) Link Check menu | Repeat the first open, deliberate search, close/Back and preserved inspection on physical iOS. Check keyboard/scale, narrow/short scroll and focus. Reuse the existing shared-source and six-shell/two-mount evidence where still current. Fix any reproduced defect at its owning shared source, then ship the affected consumers. | Close when current releases and actual iOS evidence cover the remaining criteria. Record a specific device/session dependency if unavailable. |
| [#192](https://github.com/loftwah/app-composer/issues/192) Workbench | Start with `/demo` and `src/components/CompositionWorkbench.tsx`. Try connect/edit/hide/restore/disconnect, ownership peel, sandbox revisions and the Init handoff. Compare the delivered specimen against the owner’s later motion/material direction and measure only the remaining behaviours that matter. | Existing functionality is extensive. Complete the outstanding visual depth and human/physical acceptance where available. Preserve touch scrolling and the actual sandbox ownership semantics. |
| [#114](https://github.com/loftwah/app-composer/issues/114) / [#115](https://github.com/loftwah/app-composer/issues/115) Saved stacks and mini-apps | Use native Stacks to keep two fictional drafts distinct, open a real app, configure instances, preview and publish revisions, then verify the public state, share destination, unpublish and rejected actions. Use the Creator Hub follow-up to prove the relevant bits once. | Potential separate closures. #114 also needs duplicate/archive and isolation. #115 also needs generic different-provider/instance coverage, permission/source conflicts, remix and supported remove/reconnect/update. Record gaps per issue. |
| [#360](https://github.com/loftwah/app-composer/issues/360) / [#29](https://github.com/loftwah/app-composer/issues/29) Public paths and language | Walk a newcomer from a goal to Creator Hub and another from a different goal to a working tool. Lead with proof and a single next action. Fix broken or confusing handoffs, claims and matching metadata on the affected routes. Build on the current homepage and role routes. | #360 needs two genuinely different working demonstrations, grounded remaining audience claims and a durable #355 positioning result. #29 also retains the first-time-agent language/accessibility/metadata scope. Close either only against its own checklist. |
| [#30](https://github.com/loftwah/app-composer/issues/30) / [#420](https://github.com/loftwah/app-composer/issues/420) Visual stories | Use the existing share board/collections and captures of the actual analytics and Creator Hub releases. Reuse applicable editable diagrams and finish missing stories from #30’s list. If the configured Discord channel is authorised, use the existing showcase transport and inspect actual client renderings. | #30 is broader than one film or kit. #420 requires three real message types and actual client screenshots and message permalinks, plus deduplication. Report partial progress where appropriate. |
| [#288](https://github.com/loftwah/app-composer/issues/288) Device support | Exercise an app’s actual main task and its limits from Init intent to library, launcher and independent entry. Write current per-revision evidence via the existing device declaration. Combine with #177, #193 or LDraw when the actual device/task is available. | Partial per-app progress is useful. Leave unsupported or unverified work explicit. Keep emulator and physical results distinct. |

Two further tracks can ship independently when their prerequisite exists. **#397 SEO Workbench:** use authorised first-party Search Console data, then publish one evidence-backed finding and a reviewable draft with an explicit later comparison. The previous 61-URL crawl supports technical checks only. **#264 Paperwork / #290 LDraw:** use the owning repositories and current approved assets. Finish a real phone/file/export or editable/offline/MCP workflow from the issue’s remaining acceptance. Paperwork document bytes and signatures stay browser-local. Prior LDraw artwork delivery is the incumbent.

## 5 · Optional maintenance in Get Ready and Init

The public library already maps H0 and 22 maintenance prompts. Start from `src/lib/prompt-library.ts`, its renderer, `src/pages/{prompts,setup,init}.astro`, `src/lib/init-client.ts` and [#428](https://github.com/loftwah/app-composer/issues/428). Surface a small optional choice suited to the selected project. Show what it will check and carry the chosen stable task/revision and intended scope through save, reopen, portable import/export and the generated agent handoff. Older specs stay usable. The first visit can still reach the pre-idea setup or copy a prompt directly.

Use the existing chosen-agent handoff for one real check on the fictional reference. Show the actual action/result and its verification status. Default to assessment. If the existing scoped executor and scheduler are qualified, advance the later #428 slice through #311/#289: persist the real run reference and result in the existing native workflow, verify one deliberately enabled recurrence, pause, deduplication and offline/failure handling. Gate run and recurrence controls on real supported capabilities and leave them off by default. Keep ordinary manual use available.

## Full open-issue map

Each of the 114 issue numbers from the snapshot appears once below. The map routes work by its primary dependency. Related issues can share a release receipt. [GitHub issue list](https://github.com/loftwah/app-composer/issues?q=is%3Aissue%20is%3Aopen)

| Lane | Open issues | When to pick up the lane |
| --- | --- | --- |
| Product direction, evidence and orchestration | #1, #11, #112, #216, #425, #426 | Route actual releases and unmet gates here. Use #425 for the full creator acceptance and #426 for concrete workflow friction. |
| Public product, proof, device and design | #7, #23, #28, #29, #30, #35, #36, #177, #192, #288, #353, #360, #403, #420 | Execute the analytics/Creator Hub releases and closure candidates. Keep the extension on its real Chrome/Cloudflare path and decision Explorer on its own acceptance. |
| Get Ready, onboarding, Init and task choices | #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #285, #315, #428 | Use the real Hello and maintenance journeys. Record distinct providers, client support, exact readiness and approvals. |
| Composition, sources, maintenance and release | #3, #4, #5, #8, #9, #10, #175, #310, #317, #318, #319, #321, #408, #422 | Prove relevant requirements on the same reference. Keep monorepo, optional adapters and Oyster in bounded follow-up slices with their actual dependencies. |
| Independent products | #24, #25, #26, #27, #31, #32, #33, #34, #44, #193, #194, #246, #264, #290, #404 | Start with Creator Hub’s pair and Launch Kit. Route app changes through their repos. Maintain fictional-only assistant data. Keep Oddpull’s headless-first order and separate authority. |
| Native owner workflows, access and agent handoff | #113, #114, #115, #116, #117, #118, #198, #257, #289, #291, #311, #314, #351, #354 | Focus on Outcomes, the saved stack and one real handoff. Other flows need their own authorized owner/provider/role proof. |
| Incident, platform and FinOps | #215, #217, #218, #219, #220, #221, #266, #312, #320, #367 | Advance from existing real native surfaces where a permitted incident/provider/isolated team target is available. Keep simulations labelled. |
| Migration, plugin and audience proof | #165, #166, #167, #168, #355, #357, #358, #359, #361, #363, #365, #366, #369, #397 | Do the narrower public positioning/SEO slice when evidence is available. Preserve isolated labs, registry/licence gates and claim boundaries. |
| Commerce and fulfilment | #105, #293, #294, #295, #296 | Provider and sandbox acceptance in the established lane. Payment, capture and production fulfilment require their actual authority and state transitions. |
| Alternate infrastructure, enterprise assurance and security experiment | #179, #252, #253, #254, #255, #256, #307, #352 | Preserve the current documented scope. Revisit on concrete provider/identity demand or explicit authorisation. |

## Delivery and issue closeout

1. Refresh GitHub and local/remote/live identities. Preserve unrelated work and start from current main. Read current issue bodies, relevant owner comments and actual owning source. Use the existing issue for acceptance and write implementation PRs in the existing release path. A new issue is useful only for a genuinely uncovered requirement, such as the public chart upgrade beyond closed #213 if a dedicated owner is needed.
2. Run a focused affected-flow check before merge. Read Composer’s Woodhouse design entry and effective Impeccable guidance for UI work. Use actual rendered proof and keep the change review proportional. For runtime, integrate, then run `pnpm deploy` on clean pushed main. It runs the required check/build. Verify `/build.json`, Worker/release ID and the affected live interaction. Use the owning release workflow for independent apps. Docs/tooling complete on main with focused checks.
3. Apply the repository’s 3–5 minute target to each genuine routine release, from its first relevant code edit. If it exceeds five minutes, record elapsed time, the exact stage and reason, and the next executable action in the existing task/PR. Continue recovering it. Preserve the deliberate test reduction and existing production guards.
4. In #11 record PR, source, Worker/app pins, live URL and the actual interaction plus limits. For each owning issue record accepted requirements covered, remaining criteria and precise blocker/next step. Close with the receipt only when all applicable acceptance is evidenced. Use “Refs #…” for partial PRs so merge alone cannot auto-close them. Use the established single showcase transport if applicable and authorised, after release verification.
5. End with a short list of live things to try and a table of closed, advanced and blocked issues. Include the current production revision, relevant PRs, evidence links and any material judgement made on the owner’s behalf.

## Copy-ready implementation prompt

```text
Implement and deliver App Composer’s 12 November 2026 plan in
docs/delivery-plan-20261112.md. If it is absent in your worktree, read the
handoff copy in /Users/deanlofts/gits/app-composer/docs/delivery-plan-20261112.md.
Use AGENTS.md and current GitHub issue bodies/owner comments as authority.
Recheck local, remote and live identities, recover existing work first and
preserve other worktrees and changes. Take ownership from implementation
through review, integration, the established production release and live checks.

Ship public Activity first. Make the chart the main thing I can touch.
Let me change scope and metric, inspect a UTC day by tap, mouse and keyboard,
drill into an app and preview a shareable report with the same scope. Preserve
native forms, value tables, CSP and frozen report compatibility. Demonstrate
actual zero, missing, partial, capped and unavailable states. Reproduce and
fix any false zero or misleading route-share finding when a read fails.
Use the existing Composer identity, with short selection feedback and a
complete reduced-motion experience. Read the Woodhouse design and effective
Impeccable guidance. Show actual before/after at desktop and phone widths.

Then ship native Analytics & outcomes using the same interaction language.
Keep access, public aggregate consent and private scope boundaries. Prove a
scoped report and export in real authorised EmDash. Exercise the Creator Hub
follow-up on the same fictional app from a preview and portable handoff
through a visibly changed released app and safe refusal/return. Extend the
existing case study. Add the optional maintenance-task selection and genuine
handoff in Get Ready/Init, and advance connected/scheduled execution only
through supported #311/#289 paths.

Work through the closure candidates in the plan as each becomes executable.
Start with the live Hello retain/edit proof, Launch Kit asset use, native
Brand Studio transformation, and the remaining Link Check iOS proof when
the device is available. Continue with the existing Workbench, saved stacks,
public journeys and device support when you can prove the remaining checks.
Use the full issue map to keep adjacent work with its owner. Reuse current
evidence and close as many issues as actually meet their current acceptance.
Leave issue-specific evidence, remaining conditions and next actions when
only a slice ships. Keep #11 as the release evidence index.

Ship coherent releases as they become ready. Keep one integration writer.
Use the existing clean pushed-main deployment path and verify the affected
live behaviour against exact source/Worker IDs. Use focused checks, reuse
valid evidence, preserve the deliberate test reduction and report real
elapsed time and the specific cause if a routine release exceeds five
minutes. Use independent app releases and exact promotions when needed.
Keep fictional/demo data, permissions, existing publication and recovery
boundaries, explicit holds and owner-controlled resources intact. If an
actual account, device, approved fixture or owner action is required,
record that exact gap and continue the independent authorised work.

Return working live links, exact release receipts, and the closed, advanced
and blocked issue lists with concrete next actions. Give me a short tour
I can follow to try the chart, inspect the owner report and see the
Creator Hub change myself.
```
