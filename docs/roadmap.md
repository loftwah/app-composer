# App Composer roadmap: Build it. Keep it running.

Adopted 2026/11/20 Australia/Melbourne (AEDT, UTC+11) / 2026/11/20 UTC.

This is the ordered product plan requested by the owner. [PRODUCT.md](../PRODUCT.md) owns the product direction; [ARCHITECTURE.md](../ARCHITECTURE.md) owns system responsibilities. [#1](https://github.com/loftwah/app-composer/issues/1) owns alignment, [#590](https://github.com/loftwah/app-composer/issues/590) the integrated experience and [#425](https://github.com/loftwah/app-composer/issues/425) the first independent creator proof. Existing issues retain implementation and acceptance. [#11](https://github.com/loftwah/app-composer/issues/11) and [STATUS.md](STATUS.md) record delivered facts. This roadmap adds no second status system or blanket release gate.

All unchecked criteria below are targets. A source implementation, local check, founder demonstration and independent customer outcome establish different things. Record each at its actual scope.

## 1. The target

**Make App Composer the place where a person and their chosen agents turn an intention into something useful they own, then operate and improve it without losing their work, taste or control.**

The product promise is **Build it. Keep it running.** A person can start with a small website, an application, a game, a creative project or an automation. Composer helps them understand what to do next, connects the right tools, carries the project context and returns a result they can inspect. They can stay in the guided experience or open the underlying source, services, permissions, releases and costs when useful.

The ServerPilot analogy describes the removal of operational friction. The wider ambition includes creation, agents and creative work: people should reach the interesting part quickly, and sound engineering should support the project as it grows. Existing blocks accelerate the work; a missing block must not prevent an agent implementing a new capability.

### First flagship

**An independent newcomer launches a useful app on their own accounts, manages it, returns for a meaningful functional change, and can recover and continue without depending on our running installation.**

The owned Astro website is the first bounded release. The native EmDash Creator Hub, using the existing Linkarooie and Guestbook composition, proves the fuller application promise. Static publication does not complete the Creator Hub criteria.

### Ambition with measurable horizons

These are planning targets, not forecasts or observed results. Active delivery days count days with an available integrator and capable implementation agents. The pilot starts when the supported product is usable. Each pilot participant then has a full 30-calendar-day observation window from enrolment; report mature and still-observing participants separately. Recalibrate delivery estimates after the first integrated hosted run; name the bottleneck rather than silently moving a date.

| Horizon | Target | Interpretation |
| --- | --- | --- |
| First 3 active delivery days | Complete the owned Astro publish → second edit → failed candidate → recovery slice | Stretch delivery target, assuming the selected account, repository integration and provider access are available. A local scaffold alone misses it. |
| First 10 active delivery days | Complete the native M1b/M2 Creator Hub slice and one version-bound preview correction | Includes a consenting independent newcomer. Product work continues if participant access is pending, with that acceptance left open. Wider [#425](https://github.com/loftwah/app-composer/issues/425) obligations remain separately tracked. |
| First pilot: 10 creators, each observed for 30 calendar days | At least 7 launch; at least 5 return for a successful meaningful change | Early product learning. Report counts, assistance, non-starters and incomplete observation windows; this sample does not establish a reliability rate. |
| First 90 calendar days of the usable pilot | Stretch towards 100 independent creators with a useful owned live project, 30 qualifying returning owners, and three demonstrated creation categories | A product-and-distribution goal, conditional on the pilot working. Report the eligible retention cohort and expose a miss. Remote execution and enterprise work are not prerequisites for every creator. |

The primary outcome is **retained independent owners of useful working projects**. The platform mission adds **active customer-owned Workers and useful, recurring native Workers AI work**. Token consumption alone is not product value.

### Decision 1 — who we serve first

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Creators first, agencies next | Fast feedback on the whole journey; agencies can multiply a proven experience | Newcomer onboarding must work without founder assistance; early revenue may be uneven | **Default.** Include one person without a preconfigured coding agent in the flagship. |
| B. Agencies first | A small number of buyers can bring many sites and value operations | Adds client roles, handover and fleet needs before one project works end to end | Promote after two real client projects demonstrate the repeatable need. |
| C. Enterprise platform teams first | Larger operational problems and potential contracts | Procurement, federation and governance expand the critical path | Keep existing owners; pursue when an actual sponsor and bounded use case justify it. |

## 2. Responsibilities and durable choices

| Part | Responsibility |
| --- | --- |
| App Composer | Project intent and relationships, discovery, guided work, chosen-agent context, scoped actions, current work and evidence |
| EmDash | Composer's native administration and the supported editorial/content lifecycle of apps that need it |
| GitHub | Source, issues, changes and release provenance |
| Cloudflare | First production target: owned Workers and the selected storage, identity, AI and operational services |
| Chosen external agent | Authorised implementation in an actually supported environment, with inspectable source and returned results |
| Independent mini-apps and Media Studio | Their own source, data, editable creative originals, permissions, provider work and release boundaries |
| Optional remote providers | A separately qualified execution adapter when it solves a demonstrated continuation or compute need |

Preserve MIT/open source and independent ownership. An exported application must remain usable without a running Composer or Woodhouse, a licence callback or our private credentials. Keep separate read, write, execute, deploy and publish authority. Reuse current context, capability, request, operation and evidence contracts; extend their missing boundaries instead of building another universal executor, CMS, media store, theme engine or benchmark system.

### Decision 2 — deployment ownership

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Ordinary Workers in the creator's account | Clear ownership, direct provider controls, matches existing architecture | Account/GitHub setup adds first-session friction | **Default for the first supported recipes.** Start on the provider hostname; add a domain afterwards. |
| B. Composer-managed Workers for Platforms | Potentially simpler hosted onboarding and central fleet controls | Adds tenant isolation, abuse handling, quotas, billing, support and exit obligations | Separate later offering under [#217](https://github.com/loftwah/app-composer/issues/217)/[#219](https://github.com/loftwah/app-composer/issues/219); qualify actual provider limits before promising it. |
| C. Offer both immediately | Covers both preferences | Doubles early lifecycle and support qualification | Add the second mode after demand and the first mode's economics are understood. |

### Decision 3 — agent access

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. One supported external-agent path, portable context and returned results | Uses existing accounts where supported; preserves provider choice and independent source | Host setup, capabilities, interruptions and entitlements need clear handling | **Default.** Prove one host fully, including a novice setup path, then qualify others. |
| B. Optional hosted/remote execution | Can continue when a laptop is unavailable; supports bounded long jobs | Adds compute costs, credentials, availability and cancellation semantics | Add only through an existing qualified adapter and its actual authority. |
| C. Mandatory Composer-hosted model service | More uniform initial interface | Creates a new paid dependency, broker and operational burden | Not adopted. Any hosted helper remains optional under [#597](https://github.com/loftwah/app-composer/issues/597); do not assume a chat subscription provides API or remote-runner entitlement. |

## 3. Starting position

Source inspected at [`beb1c5d28e2f`](https://github.com/loftwah/app-composer/commit/beb1c5d28e2f54f1b330271ea33abe8225717dd9). Refresh main, the owning issues and live identity before implementation. This source snapshot is not a production-release claim.

| Observed foundation | Remaining join |
| --- | --- |
| [Local Astro generation](https://github.com/loftwah/app-composer/blob/beb1c5d28e2f54f1b330271ea33abe8225717dd9/lib/astro-website/create.mjs), content and local Workers asset configuration | [#971](https://github.com/loftwah/app-composer/issues/971)/[#972](https://github.com/loftwah/app-composer/issues/972) still need the actual selected GitHub/Workers publication, isolated hosted preview, second edit and recovery. |
| Saved briefs, readiness and chosen-agent proposals | The [current native grant is proposal-only](https://github.com/loftwah/app-composer/blob/beb1c5d28e2f54f1b330271ea33abe8225717dd9/src/lib/agent-proposal-contract.ts). Join authorised external execution to the same project's preview, source and result; do not relabel the proposal grant as deployment authority. |
| Native EmDash, independent app composition and bounded platform requests | [The existing operating path](platform/operating-path.md) uses a pinned Guestbook Worker; it does not provision an independent customer's Worker/D1/R2 or implement arbitrary source promotion. |
| Composer's guarded release path and local recovery evidence | [The deployment guard](https://github.com/loftwah/app-composer/blob/beb1c5d28e2f54f1b330271ea33abe8225717dd9/scripts/deployment-target.mjs) pins Composer's production identity. Add the bounded supported owner-target path without weakening that guard. Provider data restoration remains separately qualified. |
| Benchmarks Studio and the WordPress Studio/Spacefast comparison protocol | The local baseline recorded 15 pass / 0 fail / 0 blocked, plus 2 passing profile tests, at parent source `b3b18a55e973`. It does not prove a customer journey or competitor parity. The nine WPSF cases remain unrun. See [#935](https://github.com/loftwah/app-composer/issues/935)/[#1008](https://github.com/loftwah/app-composer/issues/1008) and the [protocol](../benchmarks/cloudflare-composition/wordpress-studio-spacefast.md). |

The main delivery problem is continuity across these foundations. Finish a useful project and its next change before expanding the catalogue.

## 4. Outcome gates

These gates describe the order in which we earn stronger product claims. Independent implementation can overlap. A milestone uses only the bounded criteria it needs from a large owner issue; it does not require closing every referenced epic. All gates begin open unless an existing scoped receipt proves the exact criterion.

| Gate | User outcome | Principal existing owners | Dependency |
| --- | --- | --- | --- |
| M1. Own the first result | Launch and manage an independently owned useful project | [#425](https://github.com/loftwah/app-composer/issues/425), [#971](https://github.com/loftwah/app-composer/issues/971)/[#972](https://github.com/loftwah/app-composer/issues/972), [#590](https://github.com/loftwah/app-composer/issues/590), [#198](https://github.com/loftwah/app-composer/issues/198) | Selected account/source authority and one supported agent |
| M2. Return and improve | Make a meaningful change with coherent content, design and preview | [#1009](https://github.com/loftwah/app-composer/issues/1009), [#311](https://github.com/loftwah/app-composer/issues/311)/[#597](https://github.com/loftwah/app-composer/issues/597), [#198](https://github.com/loftwah/app-composer/issues/198)/[#353](https://github.com/loftwah/app-composer/issues/353)/[#446](https://github.com/loftwah/app-composer/issues/446) | A revision-identifiable project; live acceptance follows M1 |
| M3. Keep it useful and running | Recover, update, understand costs and use one worthwhile runtime AI feature | [#118](https://github.com/loftwah/app-composer/issues/118)/[#215](https://github.com/loftwah/app-composer/issues/215)/[#445](https://github.com/loftwah/app-composer/issues/445)/[#987](https://github.com/loftwah/app-composer/issues/987), [#8](https://github.com/loftwah/app-composer/issues/8)/[#9](https://github.com/loftwah/app-composer/issues/9), [#219](https://github.com/loftwah/app-composer/issues/219)/[#220](https://github.com/loftwah/app-composer/issues/220), [#991](https://github.com/loftwah/app-composer/issues/991)/[#936](https://github.com/loftwah/app-composer/issues/936) | M1/M2 project; basic safety already applies from M1 |
| M4. Create beyond the starter | Produce distinct apps, games and editable creative work; reuse proven blocks | [#476](https://github.com/loftwah/app-composer/issues/476)/[#600](https://github.com/loftwah/app-composer/issues/600), [#596](https://github.com/loftwah/app-composer/issues/596)/[#659](https://github.com/loftwah/app-composer/issues/659), [#457](https://github.com/loftwah/app-composer/issues/457)/[#499](https://github.com/loftwah/app-composer/issues/499), [#931](https://github.com/loftwah/app-composer/issues/931) | A proven lifecycle; independent existing Studio work can continue |
| M5. Delegate and manage more | Bounded agent work, multiple clients and optional remote continuity | [#597](https://github.com/loftwah/app-composer/issues/597)/[#772](https://github.com/loftwah/app-composer/issues/772), [#216](https://github.com/loftwah/app-composer/issues/216)/[#219](https://github.com/loftwah/app-composer/issues/219)/[#221](https://github.com/loftwah/app-composer/issues/221), [#113](https://github.com/loftwah/app-composer/issues/113)/[#257](https://github.com/loftwah/app-composer/issues/257)/[#661](https://github.com/loftwah/app-composer/issues/661) | Respective operation/identity contracts; [#772](https://github.com/loftwah/app-composer/issues/772)'s explicit hold remains |
| M6. Repeat adoption | New owners find, launch, return and recommend with understandable economics | [#936](https://github.com/loftwah/app-composer/issues/936), [#623](https://github.com/loftwah/app-composer/issues/623)/[#613](https://github.com/loftwah/app-composer/issues/613)/[#213](https://github.com/loftwah/app-composer/issues/213), [#459](https://github.com/loftwah/app-composer/issues/459)/[#500](https://github.com/loftwah/app-composer/issues/500), [#477](https://github.com/loftwah/app-composer/issues/477)/[#586](https://github.com/loftwah/app-composer/issues/586) | Starts with M1; broader rollout follows pilot evidence |

### M1 — an independently owned first result

**Deliver:** complete [#971](https://github.com/loftwah/app-composer/issues/971)'s Astro route first while advancing the richer [#425](https://github.com/loftwah/app-composer/issues/425) Creator Hub. Use the current scaffold and supported components. Keep both projects recognisable and useful, using approved owned work for public examples.

**M1a: owned static release acceptance**

- [ ] The actual saved brief/export and copied agent task create the selected owner's source repository and ordinary Worker. Repository, account, branch, environment and exposure remain visible and correct throughout; an occupied destination is preserved.
- [ ] A branch candidate produces a preview tied to exact source. Its publication/access policy is exercised. A branch change does not alter production; a failed build leaves the last successful site serving.
- [ ] The owner publishes, reopens the same Composer project, changes a Markdown post and publishes again. Source, design and unrelated content survive. Project/release management is labelled accurately; this static route does not claim an EmDash content editor.
- [ ] Missing GitHub installation access, interrupted setup and uncertain provider acknowledgements have resumable next actions. Reconciliation prevents duplicate effects. A compatible live rollback and source reconciliation are exercised on the isolated target.

**M1b: full Creator Hub acceptance**

- [ ] One consenting independent newcomer, including the necessary supported agent setup, goes from a meaningful creative choice to their own source and Cloudflare target. Record assistance, authentication and provider waiting separately. Founder-account replay is a narrower rehearsal.
- [ ] The deployed Linkarooie/Guestbook composition has working visitor behaviour and native EmDash owner controls. The owner edits content and moderates an authorised contribution. Preserve the supported upload boundary; do not invent anonymous-photo support.
- [ ] The same person returns for a functional change, such as a category/filter with a corresponding owner control. Prior contributions, permissions and customisation survive. A colour-only change is insufficient for this criterion.
- [ ] Source/configuration and the supported data/media can be exported and used independently. Show what is included, what requires owner credentials and what recovery has actually been exercised. Existing project privacy and permission checks apply from the first live data.

**Decision 4 — what we build first**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Owned static slice, then full Creator Hub | Ships a useful result from the existing scaffold; exposes the missing lifecycle quickly | Requires an explicit second gate for dynamic app/admin capability | **Default.** Advance shared/native work in parallel; the Creator Hub need not pass through a static scaffold. |
| B. Creator Hub only | Stronger first editorial/application demonstration | More storage, identity and recovery work before the first complete hosted result | Prioritise if its critical path becomes shorter; retain the same full acceptance. |
| C. Arbitrary application generation immediately | Broadest apparent ambition | Makes the first supported lifecycle difficult to isolate and explain | Reach this through M4's unseen brief after the lifecycle works. |

For [#971](https://github.com/loftwah/app-composer/issues/971), the explicit selected Workers Builds profile is the default Git-publishing recipe. Existing local/agent deployment remains valid for other supported projects. One system controls a target's deployment; this does not switch Composer's own release process or introduce GitHub Actions.

### M2 — enjoy changing the same project

**Deliver:** [#1009](https://github.com/loftwah/app-composer/issues/1009)'s point-at-preview → chosen-agent change → inspected result, with native EmDash editorial work and retained taste. Match the useful WordPress Studio/Spacefast creation loop within our supported architecture.

- [ ] Feedback retains the original request, selected element/region, viewport, source/build identity and relevant permitted project references. A stale preview prompts reconciliation rather than silently applying a change to a different version.
- [ ] The chosen agent returns a real source change and fresh preview. The owner compares the result, accepts or rejects it, and the accepted release is independently checked live. Offline, cancelled and failed operations retain a clear next action.
- [ ] The native editorial path demonstrates draft → edit → eligible media → preview → publish → revise → supported restore. Discover tools from the actual installed EmDash version; role, scope and revision checks survive agent access.
- [ ] A newcomer can stay guided, while an experienced person can open source/services, request a change and return to native management without re-entering the project or losing state. Keyboard and representative desktop/phone interaction work for this journey.
- [ ] The owner can express and retain accepted/rejected design choices; a second change preserves identity, content and unrelated layout. Obtain human judgement for creative quality alongside functional checks.
- [ ] A returning independent participant performs the meaningful second change with no developer secretly repairing the result. If rescue is required, record it and leave unassisted acceptance open.

**Decision 5 — editorial depth**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Native EmDash when the project needs editorial content; Markdown for the static recipe | Fits the task and preserves existing strengths | Two clearly explained content paths need maintained examples | **Default.** Composer itself keeps native EmDash administration. |
| B. Require EmDash/D1/R2 for everything | A uniform content interface | Adds setup and operating burden to projects that do not need a CMS | Decline as a universal rule. |
| C. Build a separate universal visual CMS | Maximum custom interface control | Duplicates an upstream content model, editor and maintenance burden | Use existing editor/Brand Studio capabilities and narrow extensions. |

### M3 — keep the project useful and running

**Deliver:** a useful project overview, bounded maintenance/recovery and one recurring runtime AI capability. Basic authorisation, data integrity, isolated preview and recovery planning are M1 requirements; this gate adds demonstrated operational depth.

- [ ] The owner sees the actual deployed version, last relevant health observation, freshness/unknown state, costs and actionable problems. A stale receipt never implies current health.
- [ ] One compatible update preserves customisation and content; an incompatible update is refused with a useful path forward. An isolated fault is diagnosed and recovered within the declared scenario, with elapsed time and operator assistance recorded.
- [ ] Exercise code rollback separately from data/media restoration into an authorised isolated target. Restore checks include usable records/assets and access boundaries. Do not promise that rolling back a Worker restores bound databases or buckets.
- [ ] Requests carry source, target, permission and operation identity. An interruption or lost acknowledgement is reconciled before retry. No duplicate release/resource operation and no unapproved cross-project effect are accepted.
- [ ] Deliver [#991](https://github.com/loftwah/app-composer/issues/991)'s cited search, or another explicitly selected worthwhile runtime AI task, on an independently owned project. Exercise source grounding, access isolation, deletion/index freshness, unavailable inference, bounded retries and the owner-set budget boundary.
- [ ] Record native Workers AI inference separately from external-provider Gateway traffic, direct-provider requests, cached/no-inference responses and evaluations. Capture accepted useful outcomes, later use and observed cost; estimates remain estimates.

Cloudflare's current preview documentation requires separate D1/R2/KV resources for data isolation, and service/workflow bindings need explicit scrutiny. Its rollback documentation also separates code from bound-resource state. Build these checks into the selected operation, not a new global audit campaign. See primary sources below.

**Decision 6 — useful AI demand**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Workers AI for tasks it performs well, with explicit provider alternatives | Builds native demand through useful recurring work; keeps quality and cost visible | Requires task-level evaluation and honest attribution | **Default.** Start with one cited-search workflow and actual later use. |
| B. Force every generation through Workers AI | Simple infrastructure story | Can sacrifice task quality or capabilities and manufacture demand | Decline. Qualify each workload before routing it. |
| C. Treat all Gateway traffic as native Workers AI adoption | Easy aggregate metric | Misstates the serving provider and includes caches/evaluations | Decline. Attribute actual provider/model/execution path. |

### M4 — prove creation beyond a starter

**Deliver:** three excellent, different outputs through the same project lifecycle: a useful app/site, a playable game or interactive tool, and an editable creative/media project. Use current independent owners and Media Studio rather than making Composer a replacement for every specialist tool.

- [ ] Each output has its own inspectable source/editable project, accepted creative direction, actual working result and meaningful later change. The media proof uses a finished 30–60 second film where the existing Studio path supports it, with retained takes, one scene replacement and visual/audio review.
- [ ] One brief is selected after the starter is fixed and requires behaviour absent from the catalogue. The agent implements the missing capability and integrates it with the same ownership, preview, release and management controls. A template reskin does not satisfy this criterion.
- [ ] At least three useful versioned blocks/operations are each exercised in two materially different contexts. Carry owner, interfaces, permissions, dependencies, provenance/licence and actual limits. Extract only where the second use warrants it.
- [ ] Reuse an existing widget on an independently owned host and preserve instance identity through edit and withdrawal/revocation. Editable originals and rights remain with their owning system.
- [ ] A second owner can reproduce a supported project from declared inputs without Loftwah secrets or a live Woodhouse installation. Record missing services and portability limits honestly.

**Separate stretch qualification — Composer can reproduce a useful slice of itself:** under [#600](https://github.com/loftwah/app-composer/issues/600)/[#931](https://github.com/loftwah/app-composer/issues/931), installation B is built from declared permitted inputs, creates another useful project, accepts a meaningful change and reconstructs the declared supported slice as C. Measure exclusions, cost and assistance. This is a bounded qualification; full portfolio recursion is not a gate on ordinary creator releases.

**Decision 7 — how breadth grows**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Three strong paths; extract blocks after real second use | Demonstrates breadth and reduces repeated implementation | Defers some attractive catalogue ideas | **Default.** Keep original capability generation in the acceptance. |
| B. Launch a large catalogue immediately | More apparent choice | Multiplies unproven setup, support and maintenance paths | Add entries only with accurate availability and a useful owned outcome. |
| C. Restrict the platform permanently to websites | Narrower engineering surface | Gives up the established games/media/automation direction | Keep websites as the entry route, with measured expansion. |

### M5 — delegate work and manage more projects

**Deliver three independently qualified extensions.** They share relevant controls; completion of one does not imply the others.

- [ ] **Bounded agent operations:** for one selected useful task, an owner grants scope, budget and stopping conditions. Work retains state across an actual interruption; progress, review, cancellation, failure and unknown states are honest. Retrying a side effect does not duplicate it. Existing authority is reused without repetitive permission prompts.
- [ ] **Agency ownership:** an operator manages two separately scoped client projects, gives each client appropriate editing rights, performs a change, hands over source/data/access and revokes the operator or agent. Neither project leaks the other's information, and a handed-over app remains usable. Show per-project cost and recovery.
- [ ] **Optional phone/remote continuation:** after [#772](https://github.com/loftwah/app-composer/issues/772)'s RFC review and manual qualification gates are satisfied, exercise its smallest Guestbook private-preview pilot on one selected Computer/job. Inspect exact source, make a normal change, stop/restart, and observe sleep/offline/unknown behaviour with the laptop unavailable. The runner receives no implicit production deployment authority.

Phone-friendly review and ordinary management belong in earlier gates. This optional remote profile is the additional ability to continue actual execution elsewhere. Computer/Shed/Oyster keep their upstream responsibilities; the roadmap does not clear [#772](https://github.com/loftwah/app-composer/issues/772)'s explicit hold, revive a held Trellis dependency or create a second scheduler. [#660](https://github.com/loftwah/app-composer/issues/660) retains optional enterprise federation; it is not a prerequisite for the two-client agency slice.

**Decision 8 — autonomy**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Progressive, policy-bounded delegation | Reduces work while retaining clear scope, cost and recovery | Requires reliable state, reconciliation and understandable controls | **Default.** Start with read/diagnose, then approved changes, then narrowly pre-authorised operations. |
| B. Fully unattended arbitrary change | Broad promise and impressive demos | Unknown effects, weak recovery and unclear spending/permission boundaries | Do not promise before the individual operation is qualified. |
| C. Ask for approval at every routine step | Easy to implement superficially | Interrupts creative work and ignores existing authorisation | Ask only when the actual authority or consequential decision requires it. |

### M6 — make adoption repeatable

**Deliver:** a usable public example, a truthful guided route, evidence of returning owners and a distribution loop around finished work.

- [ ] Publish [#972](https://github.com/loftwah/app-composer/issues/972)'s actual worked example and walkthrough with the permitted source, live result, editing and recovery steps, costs and supported limits. Teach the route that passed; include the observed setup and assistance.
- [ ] Run the ten-person pilot with participant consent and a named human owner for recruitment/support. Planning this pilot does not itself contact people or authorise publication of their work.
- [ ] Of the first ten enrolled participants, at least seven launch useful independently owned projects and at least five return in a separate session for a meaningful successful change within 30 calendar days of their enrolment. Report every participant, including non-starters, and reasons for non-completion. Late entrants remain still-observing until their window matures; do not replace dropouts or change the denominator.
- [ ] Show recurring useful native Workers AI use in at least three pilot projects, on at least two separate days per project, within agreed budgets. If quality or usefulness is absent, fix the task rather than generating traffic to pass a metric.
- [ ] Scale towards the 90-day target only after the launch/return loop is understood. A qualifying returning owner has completed a meaningful change or useful operating task on a separate day during days 8–28 after their first live result. Report the denominator of owners with at least 28 days of observation alongside the count.
- [ ] Public claims match actual comparator runs and customer evidence. Publication respects consent and asset rights. Templates, examples, Share and agency referrals connect back to a working creation path.

**Decision 9 — distribution and business model**

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| A. Open-source core; excellent examples/remix first; paid help or managed operations when requested | Fits ownership, lowers trial friction and charges for continuing value | Support can become expensive; willingness to pay remains to be tested | **Default hypothesis.** Measure support cost and obtain real opt-in demand before a service commitment. |
| B. Agency-led managed packages immediately | A few partners can bring multiple projects and revenue | Adds client support, access and service obligations | Pilot after the two-client ownership proof and a willing sponsor. |
| C. Paywall the core or resell tokens as the primary product | A simple transaction to describe | Conflicts with the open-source/independence direction and weakens differentiation | Keep the core independent; price a future service only after costs and demand are known. |

## 5. How the next delivery wave runs

Use at most three bounded workstreams and one integration writer per repository. This is execution within existing issue ownership, not another orchestration system. Preserve [#590](https://github.com/loftwah/app-composer/issues/590)'s media and truthful-status lanes where they have independent actionable work; finish any already-owned release before adding more.

| Order | Work and owner | Can run alongside | Required result before the next dependent step |
| --- | --- | --- | --- |
| 0 | Integrator refreshes main, existing PRs, [#425](https://github.com/loftwah/app-composer/issues/425)/[#971](https://github.com/loftwah/app-composer/issues/971)/[#1009](https://github.com/loftwah/app-composer/issues/1009) receipts and selected provider/agent capability | Read-only reference checks | Exact unfinished slice, target and permissions; no repeated implementation of merged work |
| 1A | [#971](https://github.com/loftwah/app-composer/issues/971)/[#319](https://github.com/loftwah/app-composer/issues/319) complete the selected private-repository → Workers Builds → isolated preview → production route | 1B and bounded 1C preparation | Actual source/target identities, working owned first publication and retained state |
| 1B | [#1009](https://github.com/loftwah/app-composer/issues/1009)/[#311](https://github.com/loftwah/app-composer/issues/311) implement revision-bound feedback and the selected external-agent return | 1A using an already authorised preview fixture | Real change and fresh preview; proposal-only credentials remain scoped |
| 1C | [#425](https://github.com/loftwah/app-composer/issues/425)/[#198](https://github.com/loftwah/app-composer/issues/198) prepare and finish the missing native Creator Hub controls; [#972](https://github.com/loftwah/app-composer/issues/972) captures only observed steps | Independent native/source work and existing Media Studio work | Real visitor action, native owner operation and precise remaining independent-user gate |
| 2 | Integrator joins the affected flow, reviews the actual diff, runs the smallest meaningful boundary checks and delivers through the existing guarded path | Documentation/evidence preparation from the same result | Runtime `PRODUCTION_VERIFIED` for the affected target; docs-only `DOCS_TOOLING_DONE` on main |
| 3 | Owner/participant and agent replay the same project: reopen → meaningful change → failure/recovery | Independent M3 improvements after their needed contracts exist | Exact scoped acceptance receipt, costs/assistance and unresolved gates in existing owners/[#11](https://github.com/loftwah/app-composer/issues/11) |

Each implementation task must name: **user outcome; canonical owner; input source and target; bounded allowed actions; specific dependency; observable acceptance; relevant failure/recovery case; next action if blocked.** Use one narrow child issue only if implementation uncovers a genuinely missing bridge. Existing broad issues remain the owners.

No production deploy is complete from a successful command or merged PR alone. Inspect the actual affected live behaviour and version. Reuse valid evidence for unchanged inputs; do not repeat broad audits or rebuild a test campaign. [AGENTS.md](../AGENTS.md) retains the two-minute routine target measured from first relevant edit through verified production, including checks, integration and release. Larger product slices carry their own honest elapsed time and blockers.

If access is missing, finish code, local/protected previews and reviewable configuration that are possible, identify the precise account action and continue an independent useful lane. Do not substitute the founder's account for an independent owner or claim remote/phone execution from a prepared prompt.

## 6. Scorecard and decision triggers

Use the current analytics, cost, Benchmarks and issue records under [#116](https://github.com/loftwah/app-composer/issues/116)/[#213](https://github.com/loftwah/app-composer/issues/213)/[#220](https://github.com/loftwah/app-composer/issues/220)/[#613](https://github.com/loftwah/app-composer/issues/613)/[#623](https://github.com/loftwah/app-composer/issues/623)/[#935](https://github.com/loftwah/app-composer/issues/935). Do not build another telemetry platform for this roadmap.

| Measure | Definition | Initial target or response |
| --- | --- | --- |
| First useful interaction | A personally meaningful choice with an actual inspectable result; not a landing-page view | Measure wall time, active time and required choices; identify forced setup before introducing a speed promise. |
| Independent launch | Correct owner/source/target, useful verified live behaviour and a resumable project | 7 of the first 10 consenting pilot participants; founder/lab runs reported separately. |
| Meaningful return | Separate-session content/function/creative/operating change with a verified useful outcome | 5 of the first 10 pilot participants; use the longer-window definition for the 90-day goal. |
| Technical rescue | Undocumented developer intervention required to make a supposedly supported step work | Record every occurrence and fix the most repeated obstacle before expanding the catalogue. Official sign-in/consent is reported separately. |
| Native AI value | Accepted useful runtime outcome served by native Workers AI, later used again | At least three pilot projects show repeat use on separate days; disclose model/provider, cache and evaluation traffic. |
| Cost per accepted outcome | Observed provider/build/inference cost plus separately reported assistance; estimates labelled | Stay within each owner's agreed limits. Model/token activity without an accepted result is not success. |
| Recovery | Declared failure, supported recovery action and verified usable result | Exercise the scenario, record elapsed time and limits; do not infer data restoration from code rollback. |
| Breadth and reuse | Three materially different outputs; useful blocks exercised a second time | M4's three categories and three twice-used blocks; catalogue size is not acceptance. |

### When to change the plan

- **Onboarding dominates failure:** fix the common supported path first. Compare the simpler own-account flow with an explicitly costed managed-host proposal; change topology only with evidence and a supported exit path.
- **People launch but do not return:** investigate whether the project is useful and whether editing/operations are clear. Improve the return loop before adding more providers or buying distribution.
- **AI output is weak or expensive:** compare a smaller task/model, deterministic implementation and a permitted alternative provider. Preserve the budget and attribute the eventual serving path honestly.
- **Integration is the bottleneck:** reduce concurrent work and finish the oldest owned slice. More agents do not justify a growing undelivered PR queue.
- **A remote/upstream capability is unavailable:** keep its profile blocked and use the supported external-agent path. Do not weaken isolation, expand a grant or duplicate the upstream system to obtain a nominal pass.
- **The ten-person pilot misses 7 launches or 5 meaningful returns:** keep the public-beta claim open, choose the dominant failure to fix, and replay affected journeys with explicit cohort accounting. Do not hide the miss by redefining an attempt.
- **The pilot works and support is manageable:** expand examples and consented recruitment, qualify the next agent/provider path, and test agency/paid-service demand. The 100-owner goal then becomes a distribution problem as well as an engineering one.

## 7. Competitive benchmark and evidence

[#1008](https://github.com/loftwah/app-composer/issues/1008) owns WordPress Studio/Spacefast comparison; [#1009](https://github.com/loftwah/app-composer/issues/1009) owns the preview-feedback implementation. Run the same bounded brief through each available tool, keeping source/version, account readiness, setup, costs, assistance, creative judgement and functional outcome visible. Use the [existing nine-case protocol](../benchmarks/cloudflare-composition/wordpress-studio-spacefast.md) and [#935](https://github.com/loftwah/app-composer/issues/935)'s runner/evidence ownership.

Compare first meaningful result, preview/refinement, editorial change, Git/source ownership, live publication, later revision, failure/recovery and portability. Match relevant supported outcomes; mark incompatible architectural features as such. Competitor access that is unavailable remains unrun. A local Composer check or marketing feature claim cannot establish parity or superiority.

Use GitHub issue links for detailed acceptance, the actual release record for delivery and the original provider/creative record for cost or provenance. Keep a short roadmap update when order or a default decision changes. Do not copy every release receipt into this file.

## 8. Primary technical references

Reviewed 2026/11/20 Australia/Melbourne (AEDT, UTC+11) / 2026/11/20 UTC. Documentation can move; verify the selected installed/runtime version when implementing.

- [Cloudflare Preview resource isolation](https://developers.cloudflare.com/workers/previews/resources/): D1/R2/KV and other account resources require explicit separation; Workflow/service bindings must be inspected rather than assumed isolated.
- [Worker rollback boundaries](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/): code/deployment recovery does not restore connected resource data, and incompatible resource changes can prevent rollback.
- [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/): retryable steps require idempotent or reconciled external effects. Durable execution does not by itself make arbitrary side effects happen exactly once.
- [AI Gateway analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/): provider/model/cache attribution and cost observability; sampled or estimated aggregates must not be presented as an exact invoice.
- [EmDash MCP reference](https://docs.emdashcms.com/reference/mcp-server/) and [Cloudflare deployment](https://docs.emdashcms.com/deployment/cloudflare/): use installed capability discovery, native content/revision contracts and the selected deployment's actual bindings.
- [Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/) and [its limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/): a separately qualified managed-host option, with current limitations distinct from ordinary Workers.

**Planning confidence: 90%.** The product direction, issue ownership and source gaps are well supported. Delivery speed, independent-user conversion, repeat use, operating cost and optional runner availability still require observation. Confidence is a judgement about this plan, not an experimental success rate.
