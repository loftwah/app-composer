# Product
<!-- impeccable:product-schema 1 -->
Reviewed 17 November 2026. Sources include the owner’s creation and operations brief and [GitHub epic #1](https://github.com/loftwah/app-composer/issues/1).

## Platform
web

## Stack
EmDash, Astro, TypeScript, Cloudflare Workers, D1/R2, Access, GitHub and external Codex. Woodhouse operates implementation; customer applications do not depend on it.

## Users
Creators, developers and teams who want to make and run something they own. Beginners should be able to start with an idea and references. Developers and operators should be able to inspect and control the underlying source, services and releases. Agents are also users of the platform’s structured interfaces. The human is MP from the beginning, including before they have an idea.

## Product Purpose
App Composer is an open-source, AI-native creation and operations platform. Its purpose is to let people express an outcome and shape it to their taste while agents coordinate the tools and work needed to bring it to life. The person directs the outcome, approves consequential actions and retains control of their work, source, data and accounts.

### What we are building towards

- **A continuous project lifecycle.** Understand the goal and references, design, build, provision, test the actual experience, deploy, operate and improve the same project. Production evidence should show what works and inform what to change next.
- **Reusable building blocks.** Make components, apps, integrations, agent skills and deployment recipes discoverable and composable in the browser and through structured APIs such as MCP. Record who owns each block, its interfaces, versions, dependencies and permissions. Independently maintained tools keep their own release boundaries.
- **Creative work inside the workflow.** Media Studio and the shared asset ecosystem should help people and agents find, make, edit and reuse artwork, audio, video and other assets within a project. Carry forward selected references, iterations, provenance and rights. Only eligible, rights-cleared work belongs in public libraries. Private projects and source materials stay protected.
- **Production operations and governed agent work.** Cloudflare is the first infrastructure focus. Agents should work within explicit permissions and leave inspectable records of actions and results. Deployment, health, recovery, security and costs are part of operating a product. Team and enterprise support requires scoped access, tenant isolation and auditability.

The goal spans applications and websites, games, media and creative tools, documents and other artefacts, automations and agent workflows, and the infrastructure behind them. Evaluate quality through the work itself, including design, accessibility, reliability and evidence from actual use. Treat this scope as product direction. Describe availability with working examples and current release evidence.

### Where the supported path starts

The supported application path uses EmDash and Cloudflare. It carries forward lessons from WordPress, including approachable content models, editable fields and forms, reusable features, white-label customisation and source ownership. [Creator Hub](https://composer.loftwah.com/creator-hub) demonstrates composition and a follow-up change. [Media Studio](https://composer.loftwah.com/media-studio) shows the creative workflows. [Release evidence](https://composer.loftwah.com/release) records the verified scope.

Get Ready is the independent agent getting-started capability: a reusable library/programmatic API, CLI and optional local MCP that prepare a supported environment and prove HTTPS before an app idea. Init is the structured brief/content/field/form workflow inspired by MetaBox/ACF, with versioned app contracts and portable specifications. Composition joins independently maintained applications through data and actions.

WordPress-to-EmDash migration and carefully selected plugin equivalents are legitimate product directions, evaluated against actual user needs, EmDash capabilities and licences. Do not recreate WordPress-only machinery that Astro/EmDash already replaces. A plugin name or successful import is not feature parity. Current Composer uses EmDash for its managed catalogue; wider application CMS authoring and arbitrary plugin/form generation remain work to deliver.

Cloudflare's US$5/month Workers Paid minimum is an entry price, not a total-project bill or hard cap. Storage, request/CPU usage, domains, external agents/providers and applicable services can cost more. No guaranteed savings, universal migration compatibility, Cloudflare endorsement or acquisition is implied. Potential commercial value and employment opportunity must be earned through useful working software and verified public presentation; no outbound pitch or deal is authorised by product positioning.

## The AI-era one-click creation workshop

Reviewed 16 November 2026. See the [federated project architecture](ARCHITECTURE.md#federated-project-architecture) for project context, service ownership and integration boundaries.

Owner product mental model: one-click open-source installers made existing software accessible without server expertise; Portainer makes deployed services operable. **App Composer extends that idea to things that do not exist yet.** A person chooses what they want to make, supplies intent and examples of their taste, and works with their chosen agents to create, test, run, own, remix and evolve the result. This is the creator-facing promise, not a claim that every type of creation or unattended deployment is already implemented.

**The catalogue is made of possibilities and reusable LEGO blocks, not only installed apps.** Valid outcomes include applications, websites, games, music, film, artwork, characters, design elements, media assets, documents, diagrams, artefacts, workflows and automations. A block may be an independently deployed service, callable capability, UI component, content model, theme, agent skill/recipe, connector, approved source-media reference, finished asset, identity kit or reproducible project blueprint. Represent each kind truthfully: an image is not an executable action; a prompt is not a deployed application; a preview is not a production release. Use existing capability contracts and original owner systems instead of creating a second universal registry, media library or orchestration service.

**Creator-first flow:** choose an outcome or remixable example → progressively express intent, style, references, accepted/rejected examples or an optional guided form/conversation → inspect an appropriate proposal, dependencies and real preview → reuse verified blocks and commission original agent work where needed → make, review and verify the actual result using the creator's supported agent/accounts → retain editable originals where available, versioned artefacts, source, rights, history, ownership, operations and a path to improve the same creation. Provide a meaningful first step before exposing Cloudflare, providers, credentials or advanced project controls. Experts can inspect underlying contracts and skip guidance; beginners should not need to understand servers.

**Taste is project-specific, revisable and owner-controlled.** Keep explicit choices, inferred suggestions, reference provenance, rejections, licence and privacy boundaries distinct. Approved preferences and brand identity carry across later revisions and supported agent handoffs without leaking between projects or turning private source files into public exports.

**Everything we have or build is a candidate source of reusable LEGO.** Reuse is earned by a real second use and an exercised versioned contract, not by indiscriminately publishing generated files. Existing apps and Studio remain independently owned with their own repositories, D1/R2, rights, grants and release histories. Composer is the coherent front door and control plane, not the mandatory runtime for every creation. Name installed/connected/planned/unsupported status accurately, and show actual provider capability, authorisation, possible cost and proof before claiming creation or operation succeeded.

**Delivery ownership:** [#590](https://github.com/loftwah/app-composer/issues/590) owns the integrated creator journey, [#600](https://github.com/loftwah/app-composer/issues/600) the cross-project LEGO catalogue and portable blueprints, [#476](https://github.com/loftwah/app-composer/issues/476) typed executable composition, [#21](https://github.com/loftwah/app-composer/issues/21) structured briefs, [#446](https://github.com/loftwah/app-composer/issues/446) creative preference continuity, and the owning Media Studio and app repos their respective production implementations. Actual delivery and remaining gaps are tracked in those issues and release receipts.

## Capabilities and Constraints
First pair: moderated Photo Guestbook and Linkarooie. Source independence, current visibility, configuration preservation, exact versions and safe code rollback are requirements. Public browsing requires no account. Public visitors have no deployment authority. No GitHub Actions, new paid commitment or real sensitive assistant data. Carry / forward uses fictional fixtures until its security gate is demonstrated. Optional extension is third-party, never represented as a Cloudflare feature.

## Brand Commitments
Public discovery leads with the App Composer brand, the working apps and Media Studio. Linkarooie opens the published profile and Share opens the artwork collection. Fictional exercises belong in Demos. Other portfolio projects belong in the project directory and in credited examples. App Composer is the product name; Loftwah attribution is secondary. Original graphics and distinct mini-app identities. Agent chooses routine design decisions under MP's explicit delegation.

## Evidence on Hand
Initial repository contained README and MIT licence only. GitHub issues 1–36 are implementation requirements, not evidence of shipped features. Live proof must record source and Worker identity. Review dates accompany claims.

## Product Principles
Agent executes and verifies; MP supplies human capabilities. Configuration is data, not authority. Explorer never executes. Source updates cannot override customisations or revive deleted data. Unsupported paths remain explicit.

## Reference-led creation and operation

Reviewed 2026/11/12 AEDT (Australia/Melbourne, UTC+11) / 2026/11/12 UTC.

App Composer supports an ongoing collaboration: describe a useful application,
inspect the proposed behaviour and appearance, build it, operate it and return to
improve the same owned application. Help a newcomer obtain and connect a
supported agent as part of Get Ready; an existing development setup is not assumed.

Each project keeps its own curated references alongside its intent and
implementation guidance. Record what a reference contributes, its source and
applicable usage terms, and whether it is selected, exploratory or rejected.
Retrieve a relevant subset for the task. Keep private collections in their
established private locations and public guidance appropriate to its audience.
Asset Hunter is retired; its reference-curation idea continues per project.
Existing approved identities and app-specific creative direction remain
authoritative.

For substantial new work, a stronger suitable model turns intent, references and
behaviour requirements into an actionable GitHub issue with acceptance outcomes.
Use a visualisation, prototype or preview to make consequential product choices
inspectable before committing to the implementation direction. The human supplies
meaningful judgement; routine technical decisions and already authorised work
continue without repeated approval.

An economical capable model normally implements the bounded issue. A stronger
review pass examines the actual changes, checks relevant behaviour and resolves
concrete defects against the intended result. Choose models and handoffs by
demonstrated capability, task risk and available capacity; escalate when
implementation uncertainty warrants it. Small routine fixes keep the existing
proportionate review and delivery path without an extra model cycle. Retain useful
decisions and truthful evidence in the existing issue and release records.

Use the person's existing supported agent and account through browser, app, API,
CLI or MCP integrations. State which account and entitlement performs the work.
A chat subscription is not evidence of API entitlement; an unavailable
integration remains explicit. Show incremental cost before requesting the
corresponding commitment, and never silently substitute hosted inference or
require token resale.

Keep ordinary user actions discoverable in the browser, native EmDash
administration and familiar applications or channels such as Discord, Slack or
RSS where appropriate. Technical detail remains available when useful. Roles,
teams, app resources and enterprise connections extend the existing scoped
contracts. The optional third-party Chrome extension brings the same experience
into Cloudflare Dashboard. Independent mini-apps retain their source, data,
identity and release ownership.

Keep App Composer MIT and open source, with useful ownership and continued
operation independent of a Composer licence callback. Product value and
Cloudflare/Workers adoption are demonstrated by people creating, managing and
improving working applications.
[#425](https://github.com/loftwah/app-composer/issues/425) owns the flagship proof
and [#11](https://github.com/loftwah/app-composer/issues/11) its release evidence;
existing implementation issues retain their scopes.

## Accessibility & Inclusion
Meaningful HTML, keyboard operation, visible focus, reduced motion, mobile and desktop layouts.

## Positioning sources — reviewed 14 October 2026

MP clarified the EmDash/WordPress/agent studio positioning during active implementation. Official sources checked: https://blog.cloudflare.com/emdash-wordpress/ , https://docs.emdashcms.com/migration/from-wordpress/ , https://docs.emdashcms.com/migration/porting-plugins/ , https://developers.cloudflare.com/workers/platform/pricing/ . Current design reference: Cloudflare Kumo's accessible semantic component approach and agent-readable registry at https://github.com/cloudflare/kumo and https://kumo-ui.com/registry/ . These are references; Composer retains its original identity and native Astro behaviour, without claiming those packages are installed.

## Follow-along learning — reviewed 14 October 2026

`/learn` is the newcomer route from agent inspection and Get Ready to an owned Hello change, composition, content authoring, quality and maintenance. Use existing maintained setup instructions, handoffs, readiness reports and Init; no second setup engine. Each lesson supplies a task, expected result, recovery help and optional understanding check. Self-reported observations save on the device and never certify setup, grant execution authority or enter readiness evidence. Keep the guide readable without JavaScript and each stage reachable directly. Browsing a public composition and exporting a model remain distinct from authorised writes and a deployed customer app.

Reviewed 14 October 2026: the learning journey must explain what each choice gives people, when it helps and its responsibilities inline. Direct agent-built Workers/Astro applications, optional EmDash content authoring, standalone mini-apps and composed apps are valid distinct choices; mini-app contracts are optional. Useful project guidance and scoped, exercised skills accompany any path. Before valuable data is accepted, teach proportional recovery: acceptable loss/downtime, code/configuration, database, media, account/key access, retention and tested isolated restoration. Backup, redundancy and code rollback remain separate claims. The tutorial recommends and explains these choices without pretending to provision or verify them for a customer.

## Service choices and administration — 14 October 2026

MP clarified that App Composer connects the ACF/MetaBox content-model lesson, Koji-inspired configurable mini-apps, EmDash administration, Cloudflare app-owned resources, Get Ready and Init. The main page and public /guide explain that responsibility model, practical usage, WordPress/Cloudflare/AWS differences, commerce, email and operational ownership. Shopify and Stripe should both be future selectable connections; Printful supplies future fulfilment. These are documentation and roadmap requirements, not authority to provision merchants, charge, fulfil orders or build commerce adapters now. Retained WooCommerce is a legitimate option. Each order has one checkout owner.

The first administration slice connects the existing Guestbook/Linkarooie through EmDash's native extension APIs, preserving their own D1/R2 and reviewed source pins. Invited admin access does not grant public customer login. Screenshots must capture verified working interfaces, carry source/date provenance and expose no credentials or private records. Broader customer authoring/admin and catalogue media models retain their actual remaining gates.

## Loftwah reference creator —16 October 2026

MP directs Loftwah to become the first complete creator stack built with reusable Composer capabilities. Linkarooie is the personal entry point, Guestbook the moderated participation surface, and independent music/games/projects the useful content. Composer remains a generic platform. The canonical direction, explicit publication exclusions, guest/owner boundary and console/CLI intent are recorded in [the reference creator brief](docs/creator-stacks/loftwah.md); existing #24/#25/#112/#116 own delivery and #11 owns release proof.

## Device targets — 24 October 2026

Composer discovery stays usable across devices. Independent apps may target
desktop only, mobile only or both. Creator intent is separate from demonstrated
phone/tablet/desktop support for viewing, editing, playing and file operations.
Unknown support stays unknown. See [device declarations](docs/device-support.md).
