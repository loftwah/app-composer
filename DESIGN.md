---
name: App Composer
description: Approved orange-and-white identity, editorial campaign and native administration extension
colors:
  brand-orange: "#fc5b05"
  brand-orange-text: "#c74400"
  brand-action-pressed: "#e85404"
  brand-focus: "#fc5b05"
  native-control-border: "color-mix(in srgb,currentColor 30%,transparent)"
  native-rule: "color-mix(in srgb,currentColor 18%,transparent)"
typography:
  native-field: {fontSize: "16px"}
rounded: {native-field: "6px", native-button: "8px"}
---

# Design
Reviewed 22 October 2026. Ordinary creative direction delegated by MP.

## Share artwork — 18 November 2026

Share is an exhibition of actual catalogue artwork. A larger first piece sets
the opening rhythm, followed by the same uncropped masonry wall. The opening
piece follows the current filters and order, including a seeded shuffle.
Captions align on ruled edges and keep project and category visible. Search and
sort stay in reach, with additional facets in a native disclosure and removal
links for active filters.

The viewer uses the active ink or paper theme and gives the complete artwork
its own stage. Credit sits with the title. Full-size viewing, downloads, source
notes and project kits remain available in the viewer and at the artwork's
permalink. On phones the details follow the artwork. The gallery retains
ordinary links, a native filter form and server pagination without JavaScript.

## The homepage project selection — 18 November 2026

The owner selected the complete **Build it. Keep it running.** workshop campaign as the front door. Use the supplied artwork edge to edge within its frame, including its lettering and mark. The opening actions lead directly to Media Studio, the apps, Linkarooie and Share. Use the approved globe artwork alongside the Cloudflare build and cost guide. These two references establish the brand direction for this surface.

Linkarooie is a destination for its published music, writing, games and projects. Guestbook is one library app. The fictional postcard collection and its editor belong in Demos. Show the broader build, creative and operating tools on the homepage, with the wider portfolio last.

## Public front door — owner direction 2026/11/10 (Melbourne AEDT / UTC)

MP selected [0.security](https://0.security/) as the quality reference for Woodhouse and App Composer: a coherent full-width composition, confident readable typography, generous space, purposeful motion and strong product-specific visuals throughout the page. This raises the presentation standard without copying the reference site's identity or changing Composer's approved mark.

The current opening leads with building an owned app. Its primary actions open Media Studio, the library, Linkarooie and Share. The Creator Hub example follows the featured work. The header, menu, launcher, gallery, film and community surfaces use the active theme tokens. The `product-home.css` stylesheet is confined to the homepage and its opt-in shell.

Theme correction, 11 November 2026: the opening and closing panels previously stayed dark/light regardless of the toggle. They now follow the active theme, and the header controls sit on matching surfaces. The light opening uses dark ink on warm paper with a darker orange accent; the dark opening uses light text on ink with the brighter accent. The closing panel follows the same pairing.

The 11 November 2026 review covered the previous composition at 1440px and 390px in both themes, with overflow checks at 1024, 768, 600 and 320px. Issue #7 owns the public experience and #11 records production identity and live-flow evidence.

## The studio that prints itself — 13 November 2026

MP asked for the homepage hero to become an ambitious, explorable browser
experience, using the supplied concept and Three.js blockout as a starting point
rather than finished art. The result is one authored 3D workshop: a Paperwork
press stamps a fictional form and slides it out, an LDraw pencil line rises into
paper architecture, and a separate evidence lens makes Composer analytics
explorable. The camera moves through the same room; this is not a carousel of
screenshots or floating panels. The earlier sliced-artwork hero and the
`codex/studio-hero-motion-20261113` blockout are superseded by this direction.

The approved orange-and-white Composer mark, Space typography, ink/paper
palette, ordinary Paperwork/LDraw/analytics links and the Get Ready action remain.
The world uses Three.js 0.187.0's mature WebGL2 renderer, authored geometry,
canvas-generated print textures and a depth-contour finishing pass; no universal
WebGPU support or measured frame rate is claimed. Dark and light themes re-light
the same workshop and swap the floor; the copy and poster remain live HTML.

The opening is never required to reach an app. A transparent poster of the same
scene, a server-rendered three-station static panel, ordinary links and the same
Get Ready action cover no-JavaScript, Save-Data, module and GPU failures. The
live console supports native buttons, keyboard shortcuts (`1`–`3`,
`P`, Escape) and a labelled pause. Reduced motion uses static states and disables
ambient motion and camera easing. Rendering stops offscreen or hidden; pixel
ratio is bounded and frames follow the display refresh. Sustained slow frames
can lower resolution while keeping the lighting consistent. Fictional form/drawing state is explicit. Analytics is a
separate instrument and PDFs, signatures or drawings never feed it; no invented
live counts are shown.

Details, poster provenance and the checked width/theme/interaction set live in
[studio-hero.md](docs/studio-hero.md).

Motion correction, 2026/11/14 AEDT (Australia/Melbourne, UTC+11) / 2026/11/14 UTC:
the camera opens settled and only travels when a station is selected. Stamping
uses the press and paper response without a zoom. Page content stays visible
and stationary while scrolling. A complete first frame precedes the short
poster handover, and the responsive copy and desk keep their natural space.
Button actions replace sliders; pause and reduced motion render one complete
static state and then sleep. The implementation PR owns current validation and
the remaining production gate; previous release receipts are historical.

## Superseded slice image treatment — 2026/11/13 AEDT (Australia/Melbourne, UTC+11) / 2026/11/13 UTC

The following records the earlier hero's provenance. The workshop above is the
current implementation and motion direction.

The owner selected [Slice](https://slice-image.dev/) by Luna as a visual
reference. The former homepage used twenty rounded SVG strips to display the
approved orange-and-white Composer tile behind the Paperwork capture and
fictional Launch Kit export. It used first-party assets and original geometry.
The release was reviewed at 1440, 390 and 320px in both themes. The component
and its styles were retired after the workshop replaced that composition.

## Approved identity and campaign direction — 22 October 2026

MP approved the orange-and-white merging-block icon as App Composer's canonical identity. The editable vector master is `public/brand/composer-icon-20261022b.svg`; the orange tile, reversed mark and wordmark lockups are derived from it. Use the approved artwork in the header, favicons, Apple touch icon, PWA icons, maskable icon, launcher, extension and generated content sites. Do not restore the rejected assembly-scene crop or the old interlocking-squares mark, and do not reinterpret the mark as a new logo.

The PHP2Shell campaign uses a flat orange-and-white editorial surface: large Space Grotesk type, simple geometry, generous negative space, thin white rules and a clear action. The supplied campaign artwork is the approved asset. Its square and vertical exports are deliberate reflows of the same copy, not crops or stretches. Campaign surfaces may be brighter and flatter than the operational UI; operational screens keep their existing tokens, controls and mini-app identities. Avoid neon, glows, gradients, fake 3D, circuit-board decoration and generic AI illustration.

## Colour roles, reviewed 23 October 2026

`#FC5B05` is the single canonical App Composer orange. It is an identity and action colour, not a universal text colour. `src/styles/global.css` owns the public tokens; `public/brand/launcher.css`, `src/lib/stack-theme.mjs`, the generated content-site template and the native Composer admin panels consume the same roles.

| Role | Dark | Light | Declared pair |
| --- | --- | --- | --- |
| Brand identity / primary action fill | `#fc5b05` | `#fc5b05` | Ink `#17181b` on fill: 5.61:1 |
| Action hover | `#ff7a33` | `#ff7a33` | Ink `#17181b`: 6.83:1 |
| Action pressed | `#e85404` | `#e85404` | Ink `#17181b`: 4.82:1 |
| Links and text accents | `#fc5b05` | `#c74400` | `#fc5b05` on `#17181b`: 5.61:1; `#c74400` on `#faf9f7`: 4.69:1 |
| Link hover | `#ff7a33` | `#a63a00` | 6.83:1; 6.19:1 |
| Focus / non-text indicator | `#fc5b05` | `#fc5b05` | 5.61:1 on dark, 3.01:1 on `#faf9f7` |
| Selected surface | `#3b2b21` | `#fff0e5` | Paired with foreground, not brand text |

The launcher uses `#fc5b05` on its dark paper and `#c74400` on its light paper because the same variable also labels “You’re here”. Composer-default generated sites split `--accent` (text) from `--action` (fill), so a custom owner palette can change both deliberately. Independent Here / there, Linkarooie, Link Check, Hello World and Carry / forward keep their own artwork and accent colours.

The product's unique mechanism is connecting independently owned pieces into working software. The audience works between an idea, a repository and a live site. Grounded visual directions considered: modular Swiss identity manual; publishing paste-up; transit interchange diagram; audio routing console; annotated engineering notebook; exhibition catalogue; film edit timeline. The design seed assigned the third direction. Transit interchange carries cross-app routing with clearer product meaning than the bitmap specimen, layered reference manual or star-atlas challengers.

Use a warm ivory reading surface, charcoal text and decisive signal orange, with dark ink work areas. Source connections are crisp geometric routes; independent modules retain colours. Self-hosted Space Grotesk display and native sans body. No decorative dashboards, fabricated metrics or glow. Wide open typography and substantial rules; compact task controls stay predictable. The canonical mark is MP's approved orange-and-white merging-block icon: two rounded blocks joined into a forward arrow. Use the supplied geometry, not a reinterpretation or the retired interlocking-squares mark. Main landing mode: Persuade; Get Ready, Init and Explorer: Operate; docs: Read. Small motion traces the joining route only, disabled under reduced motion.

The `/learn` tutorial (reviewed 14 October 2026) is Read/Operate within the existing transit world: an open numbered route beside one focused lesson, orange for the current stop, restrained task panels and native observation/answer controls. On phones, enhanced navigation uses a sticky native chapter picker with previous/next controls; the two-column index remains the JavaScript-free fallback. Native fragment links support keyboard navigation and direct entry; all lessons remain readable without JavaScript, and enhanced navigation focuses the lesson title. Both themes reuse the product tokens. Progress describes personal observations saved on the device, while actual setup results use the existing Get Ready report component.

Reviewed 14 October 2026: inline lesson rationales use open prose and a labelled definition list for benefit, fit and trade-off. Essential choices remain visible; technical requests and secondary detail use native disclosures. The composition comparison is a native two-column table with row/column headers and wrapping text at phone widths. Project setup and recovery advice extend the existing reading surface without adding progression gates, new state or a second wizard.

Reviewed 14 October 2026: chapter navigation is a stable reading workspace. The context and previous/next toolbar stay visible with clearance above the lesson title. Managed chapter changes share one scroll target, native bookmark offsets match it, and history restores reading position. Zero-observation link labels are quiet; optional learning notes sit in a native disclosure. Stored observations keep the same schema and never become readiness evidence.

Get Ready and Init assistance, reviewed 14 October 2026: one native Help level control uses a ruled inline row, stacked on phones. Easy keeps optional detail available; Guided adds contextual explanations; Advanced opens source/specification details. Init starts with a goal and a separately labelled fictional recommendation preview before the explicit Use action. It reuses existing preview treatments and source contracts, without a new card catalogue or advisor chat.

Project observations, reviewed 14 October 2026: an optional native disclosure in Get Ready matches the existing domain-report treatment. A copy request and local file picker precede neutral observations, open ruled instruction/skill rows and grouped review actions. Mobile rows stack. Fictional, imported and stale observations stay explicit; no green score or readiness badge is introduced. Source details remain optional. Age updates change only the date/summary, preserving the reading surface.


Content-project creation, reviewed 14 October 2026: the existing export panel gains one native disclosure with a separate new-project request and plain capability boundary. The generated local site inherits the charcoal/ivory, orange and Space Grotesk reading surface under `content-project-v1`. Its wrapping header places the collection-name link before Edit content and Light / dark controls; the main collection title precedes open ruled published entries or an actionable empty state. Entry titles use the first unconditional string field, with model groups and labelled field rows below. Field rows stack at 600px and below. Dark is the CSS fallback; the browser script uses the system preference or a valid saved choice, and the theme control changes presentation only. Both themes retain long-text wrapping and visible keyboard focus. The template’s DESIGN.md records the built layout and states. This independent local source can adopt its owner’s identity without a Composer runtime dependency; verified owner passkey/editing acceptance and a customer deployment remain separate gates.

Init field starting values, reviewed 14 October 2026: each supported scalar field uses an optional native disclosure with an explicit enable checkbox and a control matching its type. It inherits the ruled field editor, theme tokens and phone stacking. Disabling a starting value preserves the open disclosure and keyboard focus on its checkbox. The sample form presents new-entry starting values while preserving explicit cleared, false and zero values; existing published content does not infer missing values from defaults.

Init field limits, reviewed 14 October 2026: an optional native disclosure and explicit enable checkbox reveal a maximum-character number input for text or paired minimum/maximum number inputs for whole numbers. These reuse the editor’s theme tokens and stack on phones. Limits and starting-value controls preserve disclosure state and keyboard focus across edits; conditional-field disclosures remain open while their choices change. Invalid models, limits or starting values disable export actions and explain that the preview is paused, keeping the prior preview visible until corrected.

Get Ready and Init local-work observations, reviewed 14 October 2026: loaded reports add plain inherited small text describing their dated clean, changed or unknown workspace observation beside the existing report context. Init shows it only for an explicitly remembered report; clearing or absent reports hides it. Legacy reports describe the state as unknown. This adds no badge, score or new visual treatment, and the wording keeps a saved observation distinct from a fresh source check or deployment approval.

Calendar dates, reviewed 14 October 2026: Init extends the existing Operate field editor with a top-level Calendar date choice, a day-only explanation and native date inputs in the optional starting-value disclosure and sample form (years 0001–9999). These retain the incumbent theme tokens, visible focus, ruled fields and phone stacking. The generated site's native editor uses a labelled Kumo date input with the same bounds and day-only guidance. Its public reading view keeps the open field rows and renders a semantic time element with a written month, preserving the chosen day without timezone conversion.

Project skill purpose, reviewed 15 October 2026: the existing optional Get Ready preparation disclosure describes site-building or plugin-authoring guidance with the CLI skill. The agent chooses from the actual project and task; the interface adds no purpose questionnaire or report-derived authority. The inherited copy action, manual-copy fallback, ruled disclosure, theme tokens and phone stacking remain the presentation. Preparation remains separate from finding and using the skill.


Generated content entry pages, reviewed 15 October 2026: the new-project disclosure now explains the published collection and stable individual pages. The generated reader extends content-project-v1 with linked entry titles, an inherited detail surface and a quiet bordered Back to collection link; the same shell, fields, theme and typography serve both routes. No new form control or product visual world is introduced.

Installed-package observations, reviewed 15 October 2026: the existing Get Ready project panel adds one inherited small-text paragraph below the declared commands, using the shared report wording for EmDash package metadata observed on disk or an older report's uninspected state. It retains the dark/light tokens, phone wrapping and open ruled rows, without new controls, badges or layout styling. Imported observations remain untrusted and never certify readiness, runtime compatibility or a working build; package code is not loaded or executed by the inspection.

Repeating-row links, reviewed 15 October 2026: the generated `content-project-v1` reader reuses its scalar HTTPS link treatment inside repeating rows, with the same orange link colour, visible keyboard focus and long-address wrapping in both themes. Project case studies adds an optional Website to fictional credits through the existing `/init/content` field controls, sample and export. Native preview/editor controls, phone stacking and explicit false, zero and missing-value displays retain their established treatment. The local fictional owner/passkey clear, save, publish and reload journey was exercised; customer deployment and physical-device acceptance remain separate.

Init draft handling, reviewed 15 October 2026: the existing workbench gains a ruled draft toolbar with saved/unsaved wording and an explicit Save draft action. Invalid fields pause the labelled last-valid preview and disable copy/download while keeping the layout visible; validation is announced beside the toolbar and associated with the form. A local file opens a focused inline review with Replace/Keep actions before changing the current form. Imported configuration is rendered as text, replacement does not save, and a later edit invalidates any pending review/read. Theme tokens, native controls and phone stacking preserve the incumbent Operate surface.

Profile configuration, reviewed 15 October 2026: Init extends its existing separate-app disclosure with the pinned Showcase handle and optional HTTPS social fields, plus the app-specific Compact links option. The sample shows the handle, social labels and text link rows using inherited tokens. Native administration reuses its settings form and adds per-card icon/pin controls; local save status and stale-style recovery retain inputs, with an explicit Use saved style action after concurrent changes. This is an established Operate extension; public Linkarooie naming remains a coordinated follow-on, and no owner content or new customer authentication is implied.

Native link editing extends each authored card's existing row with a disclosure, four labelled controls and a text-only local preview. Saving the selected visibility is explicit. Drafts stay in page state across app switches and failed snapshot reloads; removed records retain copyable unsaved text and discard controls. Stale saves expose the current saved fields alongside Use saved link and Keep my edits. Native form controls use readable 16px text, wrapping destinations and theme-inherited rules; no new visual world or remote preview is introduced. Browser reload protection applies while edits differ from their baseline; no persistent private draft storage is added.

Coordinated identity, prepared 15 October 2026: Linkarooie replaces Top shelf as the app label across current library/launcher, Init, administration, composition navigation and diagrams. The profile remains on the existing `showcase` IDs/routes/repository; authored titles are configuration, not labels to overwrite. Native CMS publication and exact-source activation are separate release gates, recorded in STATUS and #11.

Milestones & credits, reviewed 16 October 2026: native Linkarooie administration extends the existing Operate surface with an open ruled saved list and one inline editor. Keep host foreground/background colours, native readable fields, wrapping actions, a text-only local preview and inherited focus treatment. This does not replace the transit seed or make public Showcase typography the native admin's font system. Shared product authority remains this checkout's PRODUCT.md; no separate Showcase product world is introduced.

New achievements save as private drafts, with explicit Publish/Hide and immediate-publication wording when a published item is edited. Dates are optional year, month or real calendar day; never invent missing precision. Title, optional description/destination, fixed icon and visibility use the existing labelled controls. Field-adjacent validation retains authored text, names the valid calendar/HTTPS recovery, and associates invalid fields through aria-invalid/aria-describedby. Invalid values disable Save and Preview until corrected; corrected values restore those actions. The date and URL help stays visible beside its field, rather than leaving a disabled action unexplained.

Save/discard guards item switching. Saved-versus-edited comparison offers Use saved version and Keep my edits; ambiguous creates and removed records retain copyable text without automatic resubmission. Remove retains native confirmation. The related public Showcase surface is a ruled milestone list with Space (22px) titles, title-anchored fixed SVG symbols, optional written dates and omission of absent content; native administration continues to inherit host colours and controls.

Local finish boundary: the preserved Showcase original FIX and separate SHIP verdict score only the two material fixes. The retained private confirmation manifest records Showcase `119732524f2027a3606cd7c5cb4d6bca7ec77aed`, this native source `623e7e4e310fcaca1521e542298f6321371a5e3e`, and 16 confirmation frames at (390px)/(1440px) in both themes. Title association and visible invalid-date/credential-bearing-URL recovery are resolved; the manifest separately records Remove cancel/accept stages. Original 25-stage local qualification remains in Showcase `.private/achievement-local-qualification.json`. Evidence uses fictional data and the actual native component/bridge with simulated role 50; production, source-pin activation, human authentication and the complete homepage/artwork remain outside this finish result.


## Instance polish — 16 October 2026

MP called out the assembled, AI-generated appearance and the theme button whose visible label names the other mode. The owner instance was treated as an Experience/Operate surface: reach Dean’s profile, contributions and tools promptly, with the product homepage kept for a separate Persuade role. That homepage swap is superseded on 17 October 2026 (below): the product homepage is the front door in every mode, and owner configuration adds one instance section. The portrait, kangaroo artwork, Linkarooie wordmark, lime/purple palette and app-owned content remain Linkarooie’s visual authority, not the product’s.

The first refinement replaces the large two-line workspace slogan and duplicate identity lines with one plain destination heading and the existing approved bio. A shorter banner retains the original scene; app entries appear within the first desktop/phone screen. Each app entry has one clear destination instead of repeating its title as another Open action. Header utilities stay together, with primary navigation on one phone row. Linkarooie’s public standalone header contains its wordmark, app launcher and theme control; workspace/management remain reachable in its footer and existing Manage profile action. Mounted app navigation and owner-studio routes remain available.

The same design standard applies across Composer, all five apps, owner/editing journeys and generated sites. Public apps share predictable utilities; native EmDash editing keeps its host controls and theme. Across Composer, all five apps and the generated content-site template, the compact theme control shows the current moon/sun icon. Its stable accessible name is Dark theme, aria-pressed records the current state, and a tooltip names the switch action. Preserve each app’s existing saved preference key and theme palette. It is a quiet 44px utility target with visible keyboard focus. Do not reintroduce the prominent alternating Light mode/Dark mode text labels or another theme controller.

## Homepage identity correction — 17 October 2026

Replacing the product home with the personal profile overshot: a visitor met a portrait, a bio and Loftwah’s projects, while the product’s own metadata, app library and setup journey sat behind a configuration branch. The corrected contract: `config/instance.json` carries only `enabled`, `name`, `owner`, `description` and `profile`; `src/pages/index.astro` always renders `ProductHome`; owner configuration adds one ruled instance section that names the owner and the apps actually running here (Linkarooie and Here / there), links to the profile, and keeps a modest instance line in the footer. The header keeps the product navigation in every mode. Default sharing uses the product artwork `share-composer-20261014-v2.jpg`; `InstanceHome.astro`, `instance-share-v1.jpg` and `config/instance-share-template.html` are removed, with git history retaining them. Personal imagery stays with Linkarooie. On phones, long Init and content-model forms gain quiet jump links to their preview/export panels and back, so the workbench stays usable without scrolling the whole form. Failed catalogue requests and clipboard fallbacks keep their promises visible on the same page.

Further polish should improve the hierarchy of the actual content: bring Linkarooie’s featured picks forward on phones, use eligible original project/music imagery where it helps recognition, and reduce repeated explanatory text in the AI journey while keeping its fictional-data and encryption boundaries at the relevant actions. Guestbook needs the same attention through contributing, upload/review and moderation feedback, with actual published contributions ahead of repeated branding and decorative introduction; Link Check through inspection, prioritised findings and report recovery; Hello through its simple environment-check purpose. Get Ready/Init and native EmDash editing need clear primary actions, helpful optional detail and legible saved/unsaved/error recovery. These remain follow-up work, not claims of completion. Keep distinct app identities and make shared navigation/controls behave consistently. Avoid interchangeable card grids, redundant headers, decorative labels above headings and stale review dates in consumer footers.

A browser pass must demonstrate the useful first action at phone and desktop sizes, both themes, readable real content and keyboard interaction. Passing tests and a clean detector result do not establish visual quality. Review the composition and actual content together; explain why the layout suits this specific page. Do not add another test framework or a design score gate.


Shared command menu, 18 October 2026: Apps and Cmd/Ctrl+K open one App Composer frame across the six shells and mounted apps. The selected Composer instance is a visible home link with the same dated local assembly icon. Space typography, charcoal/ivory paper, orange keyboard selection and an open ruled footer preserve the transit identity. Each app keeps its own illustration, theme preference and destination address. The same ordered app list and studio shortcuts support task/alias search, arrow navigation and normal links; keyboard hints describe the actual controls. Touch opening focuses Close, shortcut opening focuses search, and Escape, scroll/focus restoration and short visual viewports remain predictable. This Operate extension adds no command execution or account authority.

## Composition workbench — 23 October 2026

`/demo` extends the assembly world as a working local specimen. The selected
assembly study places Here / there postcards opposite a Linkarooie collection;
the alternative inline study makes the same records unnecessarily distant.
Current source records drive both views. DOM postcards, measured SVG references
and bounded return/contact motion explain placement; no rendering loop owns state.

The ownership handle separates the same collection into four live DOM sheets:
Composer slots, instance title/layout, the selected Guestbook record/media and
exact independent source revisions. The selected record or controlling setting
is highlighted. Publication and history use finite matched-element/shutter
transitions, with immediate complete reduced-motion behavior. Revision rows name
slot identities, layout and connection state; snapshots never hold app records.
Both themes use the existing role palette, typography, original app identities
and fictional postcard artwork. Phone layout stacks source and destination while
keeping ordinary scrolling, native controls and tap/place alternatives.

The workbench uses only `composer:workbench:v1` local storage. Its deliberate
session-staged Init candidate opens the existing review/replace UI and never
saves over an existing Init draft. This is local demonstration progress, never
production analytics, customer adoption or a Cloudflare deployment receipt.


## Finding shipped work — 24 October 2026

The homepage and `/discover` expose working capabilities through original finished output and recorded interface pixels. Launch Kit and the team films lead, followed by native links to invited profiles, analytics and owner workflows. The film entry retains its local fictional scope, and signed-in destinations explain admission where it affects use. The PHP briefing remains available after the product work. The grouped header’s Explore destination opens `/discover`; the existing decision planner stays at `/explore`.

A new public capability must have an appropriate visible homepage or discovery entry and a searchable launcher destination before its release is considered discoverable. A route, catalogue record or release receipt alone does not meet that requirement. Keep native links useful without the launcher script. Shared-controller changes still pass through all independent app releases and the exact mounted-source promotion.

## Homepage and Init task pass — 24 October 2026

Measured before changing anything, at 390/768/1440 in both themes: the homepage held 53 links and buttons inside `main`, ten `<h2>` sections and 6,094px of scroll (10,245px at 390px). The first viewport offered five competing actions, a 74-word architecture lede, and a brand plate roughly twice the width of each real app capture. Link Check, Here / there and Linkarooie appeared three times (hero thumbnails, Discover, app row), and "Start wherever you are" repeated the header's own destinations.

The rebuilt front door keeps one primary action (Get Ready) and one prominent shortcut ("TLDR just give me the prompts" → `/prompts`) above the fold, then real screens: Paperwork, Link Check and Here / there inside one frame, with capture dates in the caption. The approved merging-block mark sits at 22px in that frame's flat orange label bar instead of occupying the hero. Three task pathways replace the feature rows: try a working app, build with your agent, run it with a team. Launch Kit output, the team films and Linkarooie follow as an output gallery; the owner instance is one ruled strip; the PHP2Shell briefing stays below the product work; architecture, platform, release and creator detail move to one grouped link section. No metric was invented and no page was deleted.

Init now opens on the task: the goal chooser moved from 784px (1440) and 1,316px (390) to 394px and 624px, the lede dropped from five lines to two, and the apply action stays beside the chooser rather than below a 914px preview column. The readiness report, alternative entry points and help level follow as quieter setup, then the draft toolbar and the handoff panel.

Local verification only: `pnpm check`, `pnpm build`, and a Playwright pass over 390/768/1440 in both themes, 200% root text, keyboard order and reduced motion. Captures and the exact before/after measurements are in `docs/evidence/homepage-20261024/`. Live production, physical devices, screen readers and native EmDash administration (closed locally without trusted Access) remain separate gates.

## Reusing an interaction — 14 November 2026

The Apps launcher is the first documented interaction recipe. Its presentation
can change without rebuilding search, keyboard movement, focus return, Escape or
page-position restoration, because those behaviours stay in the maintained
`src/browser/launcher.ts` controller and its single classic-deferred
`launcher.js`. The [recipe](docs/source-maintenance.md#launcher-interaction-recipe)
records the source, rendering contract, state and keyboard ownership, empty
states, fixture and verification.

`/launcher` is the runnable study: the same `AppLauncher` component, two
presentation densities, and no second controller or dialog. It is a design and
prototype reference, not a new app operation, permission or component platform.
Adopting a beta UI SDK remains deferred until a custom interaction needs more
than this controller; the study itself adds no dependency. Keep the study's
density CSS local to the study, preserve the shipped 44px controls and focus
outline, and do not treat browser checks as physical-device acceptance.

## First impression correction — 14 November 2026

The landing page leads with App Composer's real outcome: prepare tools, work with a chosen AI agent to build or connect an app on Cloudflare, and keep operating software the user owns. The three-step explanation precedes the interactive workshop, which is explicitly a fictional illustration with links to real apps. Get Ready is presented as the preparation step, not the product name. This direction addresses the reported hierarchy problem in #495; independent newcomer comprehension testing remains outstanding.

## First-app entry and the later change — 15 November 2026

The opening now names App Composer, leads with “Build your first app” into the
plain-language Learn journey, and keeps Get Ready described as the setup step.
The secondary action jumps to one inspectable Creator Hub example: two live
apps, the source and data they keep, and the second change Mara asked for on the
same profile. That example sits before the fictional workshop, which remains
clearly labelled and links to the real apps. The opening artwork is finished
Media Studio work, not a substitute for the product explanation.

Re-verified against the five visitor observations in
[#495](https://github.com/loftwah/app-composer/issues/495) on 16 November 2026.
At 390 and 1440 px the first viewport holds the product name, the owned-app
outcome, one primary action, the two secondary routes and the Get Ready
explanation; the interactive workshop begins 4,087 px (phone) and 2,715 px
(desktop) into the page, after the explanation and the real Creator Hub example.
The artwork credit now reads “Made in Media Studio, built with App Composer” so
the proof names its parent product instead of introducing a second unexplained
name. Independent cold-visitor comprehension remains the open acceptance item in
#495/#425; this note records only the source and local re-verification.

## Brand Studio tactile skin option — 15 November 2026

Brand Studio's appearance form gains one optional skin beside its reading
presets. **Workshop press** is Composer's own press-and-plate world: panels sit
inside a set-back rule, fields and buttons square their corners, and an edge
weight of 1–4 sets how heavy that rule reads. It is a saved appearance setting,
not a second theme engine: the approved mark, orange palette, native EmDash
controls, labels and order are unchanged, and the default skin is what every
existing version still renders.

The option is deliberately quiet. Edge pressure, not colour, is the variable, so
the skin cannot drift from the approved palette; both native themes derive their
plate tint from the host text colour. There is no animation, so reduced motion
loses nothing, and the pressed edge is an instantaneous visual state rather than
a transition. Optional sound and haptics live on the specimen control only, are
off by default, are stored per device, and never ride along with the published
appearance. The reference worked from (SPEC-01's scoped skin and gesture-bound
earcons) and the mechanisms deliberately left out are recorded in
[tactile skin reference](docs/tactile-skin-20261115.md).

## Portable skin contract and the second consumer — 15 November 2026

The skin layer is one finite contract with two shipped recipes and two
consumers. **Workshop press** sets panels into a measured plate; **Contact
sheet** rules them with a printed top line, squares the fields and moves focus
inside the control. Both choose from the same measured treatments in
`src/lib/appearance-skin-catalogue.ts`; neither can carry text, colour, an image, a font,
animation or an action change, and Composer default still emits no layer.

The signed-in EmDash administration and the public `/appearance` reference share
the compiler but not their storage: the admin reads the saved
`composer.admin-brand/1` version, while the reference keeps one choice on the
device. `/appearance` exists to make the contract inspectable and to prove the
mechanism portable; it is not a theme editor and never publishes.

Brand Studio compares the published version with the saved draft through a
split wipe. Both panes are the actual compiled layers for those saved versions.
The only control is a native range with a spoken position and an explicit
caption; the visual divider is hidden from assistive technology. Nothing
animates, so reduced motion has no separate path. The mechanism is an original
reimplementation of the reviewed accessible compare pattern; its source and
licence decision are recorded in
[the design harvest note](docs/design-harvest-20261115.md).

The owner-facing rule is unchanged: a skin earns its place by keeping every
control, label, role and action usable and readable in both themes. The full
recipe and verification contract is
[the appearance skin contract](docs/appearance-skin-contract.md).

## App Composer Spin identity — 27 November 2026

Spin is a first-party mini-app at `spin.loftwah.com`. The wordmark reads
Spin by App Composer. The ring, axle and orange pointer are Spin’s distinct
mark. The Composer tile remains the parent product’s identity. Use Composer’s
paper, ink and orange across the Spin header, play surface, controls and result
exports. The campaign uses separate ImageGen compositions for the four social
formats. The QR opens the public Spin homepage.

## Spin play surface — 27 November 2026

The app heading describes the action and the wheel shows the active question.
Fast food, Game night, Weekend and the preset picker sit before the wheel. A
laptop places the wheel beside the editor. A phone places the wheel and Spin
button first. A fresh visit loads the three takeaway choices and existing
drafts retain their own choices. Selecting a non-food preset hides food ideas.

Choice entry and toggles live together. Multi-select food tiles suggest individual
choices to add. Keep sound, Find ideas and Share Spin next to the wheel. Keep
reorder, bulk operations and
custom series in disclosures. A completed draw puts Spin again and Copy
result link below the winner. Repeat creates a separate verified session
with the original choices and leaves the previous draw in browser history.
