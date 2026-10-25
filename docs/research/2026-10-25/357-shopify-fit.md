# Shopify developer fit: where App Composer adds value, and where it does not

**Issue:** [#357](https://github.com/loftwah/app-composer/issues/357) (child of [#355](https://github.com/loftwah/app-composer/issues/355))
**Dated:** 2026-10-25 UTC (Australia/Melbourne 25–26 October 2026)
**Lane:** parallel run J1, read-only research
**Repository inspected:** `loftwah/app-composer` at `5e012f98e15dceb009e98468d0e541e00401d918`
**Report path:** `output/parallel-run-20261025/research/357-shopify-fit.md`

## Evidence boundary

What this report is based on:

- Current official Shopify developer documentation, fetched 2026-10-25 UTC, including the API version table (2026-10 is the latest stable) and plan/pricing pages.
- Current official Cloudflare Workers pricing and EmDash documentation.
- Direct inspection of this repository: `package.json`, `wrangler.jsonc`, `composition.lock.json`, `src/lib/apps.ts`, `src/lib/order-contract.ts`, migrations `0001`–`0018`, and the docs listed in the sources.

What was **not** done, and therefore is not claimed:

- No Shopify account, development store, app creation, install, OAuth grant, app submission, purchase, checkout, or deployment.
- No Shopify API call of any kind. Every statement about Shopify runtime behaviour is documentary, not exercised here.
- No customer interviews. Demand, willingness to pay and adoption are **unknown**, not estimated.
- No benchmark of Composer against Hydrogen, Oxygen or a theme on real traffic.

Composer's own commerce state is described from source and its own dated status documents. Where a Composer capability is not shipped, it is labelled as such.

---

## 1. Verdict

1. **Composer has no defensible advantage on any surface where Shopify supplies the runtime or the UI.** That covers themes, checkout, admin extensions, Shopify Functions and Oxygen. Competing there means competing with the platform owner on the platform owner's terms.
2. **It has one real advantage, and it is not a storefront feature.** Composer owns a small, source-owned application with a content model, human moderation/review, an operator admin and an agent change loop. Shopify does not sell that for non-commerce work; Shopify CLI plus a Git repository does not give a non-developer client an operating record.
3. **The best fit is a companion, not a replacement.** An owner-facing back office or content/community app that sits beside the store, reads selected Shopify data read-only, and hands checkout back to Shopify.
4. **The cheapest verifiable commerce path today needs no Shopify app at all.** A Composer-hosted page that hands off to Shopify checkout with a cart permalink requires no Storefront API token, no app install and no headless build. That is the one experiment worth running first.
5. **The strongest no-fit is checkout.** Checkout UI extensions run in Shopify's sandbox, are Plus-only for the information, shipping and payment steps, and `checkout.liquid` is now unsupported for those steps. A Composer "checkout" is not a weaker option; it is not an option.
6. **"Astro + Cloudflare" is not a differentiator against Hydrogen.** Hydrogen 2026-10 is framework-agnostic, documents Astro, and documents Cloudflare Workers as a supported runtime. The differentiator has to be EmDash content, moderation, ownership and the agent workflow, not the host.
7. **The largest blocker is that no Shopify adapter exists.** A repository-wide search found Shopify only in documentation, prompts, the public guide and fictional-order fixtures. There is no client, no OAuth flow, no webhook verifier and no scope handling. Everything Shopify-shaped in Composer today is proposed work owned by [#293](https://github.com/loftwah/app-composer/issues/293).

### Two tests that decide fit

Use these before proposing any Shopify-adjacent Composer work.

**The surface test.** Who is looking at the screen?

- A buyer in checkout, or a merchant inside the Shopify admin: Shopify owns the surface. Composer can generate code for it, not host it.
- An operator in a back office, or a visitor on a separate site: Composer can own it.

**The deletion test.** Delete Shopify from the design. Does the application still make sense?

- Yes: it is a Composer-shaped companion. Shopify is a data source, not the product.
- No: it is a Shopify-shaped app. Build it with Shopify CLI, on Shopify's surfaces, and stop.

---

## 2. The four jobs and the surfaces they map to

The issue asks to distinguish theme customisation, app extensions, standalone apps and headless storefronts. They differ on two axes: **who renders the code** and **whose identity the user has**.

| Shape | Code runs on | User | What it is good for | Hard limits |
| --- | --- | --- | --- | --- |
| **Theme** (Liquid, JSON templates, sections, blocks) | Shopify renders the storefront | Buyer | The store's pages, navigation, product and collection presentation, cart | Liquid is unversioned and rendered by Shopify; theme files are a fixed directory structure; the theme cannot run a custom server or own a database ([themes](https://shopify.dev/docs/storefronts/themes), [architecture](https://shopify.dev/docs/storefronts/themes/architecture), [versioning](https://shopify.dev/docs/api/usage/versioning)) |
| **Theme app extension** | Shopify CDN, injected into the merchant's theme | Buyer | App blocks and embed blocks the merchant places in the theme editor without editing theme code | Not a general app runtime; subject to theme app extension file and content limits, including a 100 KB Liquid size limit unless an exception is granted ([theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions), [distribution](https://shopify.dev/docs/apps/launch/distribution)) |
| **App proxy** | Your server, reached through the shop's domain | Buyer | Serving dynamic content under `/apps/...` on the store domain, optionally rendered as Liquid by Shopify | One proxy route per app; needs `write_app_proxy`; `Set-Cookie` and other headers are stripped, so cookie-based sessions through the proxy are not available ([app proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies)) |
| **Embedded app, App Home iframe** | Your hosting, inside a Shopify admin iframe | Merchant staff | Multi-page admin apps, server-side logic, webhooks, full browser APIs, App Bridge and Admin API access | You must implement the app's auth (token exchange for embedded apps, authorization code grant otherwise); the UI is expected to follow Polaris and App Bridge conventions ([App Home](https://shopify.dev/docs/apps/build/app-home), [authentication](https://shopify.dev/docs/apps/build/authentication-authorization)) |
| **App Home UI extension** | Shopify hosts it, Preact only | Merchant staff | A no-backend landing page for a custom-distribution app | Custom distribution only; Preact only; 64 KB compressed bundle; a focused subset of browser and target APIs ([App Home](https://shopify.dev/docs/apps/build/app-home)) |
| **Admin UI extensions** | Shopify hosts them | Merchant staff | Contextual actions and blocks on admin resources | Constrained runtime, Polaris components, no arbitrary backend inside the extension ([app extensions](https://shopify.dev/docs/apps/build/app-extensions)) |
| **Checkout UI extensions** | Shopify hosts them in an isolated sandbox | Buyer, in checkout | Custom fields, banners, upsells, thank-you experiences | No DOM or checkout page access, no payment data, 64 KB bundle (128 KB full-page customer account), network access gated by capability; information, shipping and payment step targets are **Shopify Plus only** ([checkout UI extensions](https://shopify.dev/docs/api/checkout-ui-extensions/latest)) |
| **Shopify Functions** | Shopify invokes WebAssembly | Backend logic | Discounts, delivery and payment options, cart/checkout validation, order routing | Never invoked by URL; Shopify chooses when to run it; a **custom app containing Functions requires Plus**, while public App Store apps with Functions work on any plan ([Functions](https://shopify.dev/docs/apps/build/functions)) |
| **Headless storefront** (Storefront API + Customer Account API) | Your hosting, any stack | Buyer | Full frontend control, cart, checkout handoff, content from any CMS | You own SEO, performance, accessibility, support and upkeep; checkout still hands off to Shopify; Shopify states headless costs more than a theme and needs developers to maintain it ([headless](https://shopify.dev/docs/storefronts/headless/overview)) |
| **Hydrogen** | Your framework, on Oxygen or another runtime | Buyer | Shopify-specific storefront primitives: cart, variants, predictive search, analytics, request handlers, Customer Account API | No checkout UI and no Admin API client; UI, routing, session storage, account pages and SEO remain yours ([Hydrogen](https://shopify.dev/docs/storefronts/hydrogen)) |
| **Standalone app** (not embedded) | Your hosting, outside the admin | Merchant or operator | OAuth authorization code grant, any UI, any framework | No App Bridge; the user leaves the Shopify admin to use it ([authentication](https://shopify.dev/docs/apps/build/authentication-authorization)) |

Two corrections to assumptions that appear in the issue text:

- **Oxygen is not the only place Hydrogen runs.** The official deployment page lists Oxygen, Vercel, Node, **Cloudflare Workers**, Deno and other runtimes, and gives `CF-Connecting-IP` as the buyer-IP header for Cloudflare ([deploy](https://shopify.dev/docs/storefronts/hydrogen/deploy), [other runtimes](https://shopify.dev/docs/storefronts/hydrogen/deploy/other-runtimes)).
- **Hydrogen is not React-only.** The 2026-10 core is framework-agnostic; the docs name Astro among frameworks that use the core directly, with Astro under development examples rather than a starter template ([Hydrogen](https://shopify.dev/docs/storefronts/hydrogen)).

Consequence: Composer cannot claim "Astro on Cloudflare" as a storefront differentiator. It can only claim what sits on top: EmDash content, moderation, operator workflow and reviewable agent changes.

### 2.1 What each surface cannot do, stated plainly

- A theme cannot own a database, run background jobs, or hold a server-side secret. It is rendered markup plus browser JavaScript.
- A theme app extension cannot be a general backend. It injects blocks and assets into a theme the merchant controls.
- An app proxy cannot carry a cookie session, and gives you one route root.
- An embedded app cannot avoid Shopify's auth. It also cannot be the storefront.
- An App Home UI extension cannot have a backend and cannot be publicly distributed.
- A checkout UI extension cannot see or replace checkout's payment logic, and cannot be deployed by anything except Shopify's own tooling.
- A Function cannot be called by your code. It runs when Shopify decides.
- A headless storefront cannot avoid owning everything Shopify's theme would have owned for free.
- A standalone app cannot appear inside the Shopify admin.

---

## 3. Distribution shapes, identities and money

The issue asks to separate a single-merchant custom app, a multi-merchant public app and an external standalone microsite. The differences are commercial and legal before they are technical.

| | Single-merchant custom app | Public multi-merchant app | External standalone site/app |
| --- | --- | --- | --- |
| Install | One store, multiple stores in the same Plus organisation, or development stores | Any store after review | No install |
| Auth | Token exchange if embedded, authorization code grant if not | Same, plus Shopify's managed installation conventions | Authorization code grant if it acts on a store; none if it does not |
| Shopify App Store review | No | Yes | No |
| Shopify billing | **Cannot** charge merchants through Shopify's billing system | Required to use a Shopify-provided billing solution | Not applicable |
| Protected customer data | Level 1 always available; level 2 always available for custom apps | Level 1 and 2 require review; level 2 may trigger a data protection review | Only if it calls Shopify APIs and receives that data |
| Mandatory compliance webhooks | Not required for App Store listing | Required: `customers/data_request`, `customers/redact`, `shop/redact` | Not applicable |
| Can change distribution later | **No** | **No** | Not applicable |

Sources: [distribution](https://shopify.dev/docs/apps/launch/distribution), [billing](https://shopify.dev/docs/apps/launch/billing), [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data), [privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).

Three consequences that matter for Composer:

1. **Choosing custom distribution is irreversible.** If Composer ever helps a merchant build something and that merchant later wants to sell it to other stores, the app must be rebuilt under a public-distribution app. That decision cannot be deferred cheaply.
2. **Custom distribution cannot use Shopify billing.** An agency selling a custom app must invoice outside Shopify. Procurement, tax and chargeback handling become the agency's problem.
3. **Public distribution is a compliance programme, not a deploy step.** Mandatory compliance webhooks, protected customer data review, and app review all precede listing. Composer has none of this machinery.

### 3.1 Whose identity is it?

| Actor | Real identity source | What Composer has today |
| --- | --- | --- |
| Buyer / customer | Shopify customer accounts via the Customer Account API, or the merchant's own accounts | No customer login. Composer has invited members with a Subscriber role, and explicitly states that invited admin access is not public customer login (`PRODUCT.md`, `docs/invited-members.md`) |
| Merchant staff | Shopify admin staff identity; online tokens are narrowed to that staff member's permissions | No Shopify identity integration |
| Merchant owner / agency operator | Composer workspace owner/editor/viewer membership, behind Cloudflare Access and EmDash sessions | Yes, implemented and exercised locally (`docs/workspace-access.md`, `docs/STATUS.md`) |
| Machine / agent | Shopify app client credentials or an offline token; Composer agent grant | Proposal-only, expiring, revocable grant. Accepting a proposal executes nothing (`docs/agent-proposals.md`) |

The honest summary: **Composer's strongest identity story is the operator, not the buyer and not the merchant's staff.** That is exactly why the fit is a back office or a separate site, and why an embedded admin app creates a second admin with a second login.

---

## 4. What Composer actually ships today

Verified against this repository, not against product intent.

| Capability | Evidence | Status |
| --- | --- | --- |
| Eight shipped mini-apps in the library: Paperwork, Launch Kit, LDraw, Link Check, Here / there, Linkarooie, Hello World, Carry / forward | `src/lib/apps.ts` | Shipped; each has its own repository and release, most on their own origin |
| EmDash-managed mini-app catalogue | `src/pages/catalogue.astro`; `docs/STATUS.md` reports four published entries on 2026-10-25 | Shipped |
| Composition of independent apps | `composition.lock.json` pins exactly two apps (Guestbook, Showcase) with a reviewed commit and manifest contract | Shipped for that reviewed pair; there is no generic third-party app registry |
| Native owner admin: Workflows, Needs attention, Connections, Orders, Inbox, Agent proposals | `src/plugins/*-page.tsx` (workflows, connections, orders, proposals, overview); migrations `0012`–`0018`; `docs/orders.md`, `docs/connections.md`, `docs/agent-proposals.md` | Shipped; several slices are local/preview only |
| Agent proposal workflow: grant → brief → submit → review → handoff | `docs/agent-proposals.md` | Native page deployed; accepting a proposal performs no execution. EmDash MCP tools are implemented but were not driven against a deployed EmDash instance |
| Cloudflare deployment | `wrangler.jsonc`: D1 `DB`, R2 `MEDIA`, KV `SESSION`, service bindings `GUESTBOOK`, `SHOWCASE`, `GUESTBOOK_MEMBERS`, cron trigger; Astro 7.4.2, EmDash 1.3.1, Wrangler 4.152.0 | Shipped, guarded clean-pushed-main deploy |
| Commerce order model | `src/lib/order-contract.ts`, migration `0014_orders.sql` | Shipped as a **fictional-fixture** model with no provider adapter |
| Shopify integration | Repository search: Shopify appears in `PRODUCT.md`, `docs/guide`, `docs/orders.md`, prompts, tests and the public guide only | **Not shipped** |
| Connections / secrets | Read-only inventory of named references, one scoped Guestbook read; accepts no key values (`docs/connections.md`) | Partial: no secret store, no provider credential lifecycle |
| Public customer accounts, app billing, multi-tenant onboarding | — | Not shipped. `PRODUCT.md` and `docs/STATUS.md` say so explicitly |

The public guide already states the commerce position correctly: *"These are intended future connections, not shipped Composer integrations"* (`src/pages/guide.astro`). Any new Shopify story must keep that sentence true until [#293](https://github.com/loftwah/app-composer/issues/293) lands.

**Do not claim:** Shopify connection, store authentication, order sync, checkout, fulfilment, app installation, or App Store distribution. None exists in code.

---

## 5. Job-by-job assessment

### 5.1 Shopify theme and Liquid developer

**What Shopify already solves.** Theme scaffolding, local preview, push/pull, Theme Check, GitHub integration, the theme editor, app blocks and section rendering. Liquid is documented and rendered by Shopify.

**What Composer could add.** Asset generation (Launch Kit already produces icons, PWA assets and social images), link and SEO inspection (Link Check already does this), copy and content drafting, and a separate campaign or editorial site beside the store.

**What it cannot add.** A Liquid preview, theme deploy, Theme Check replacement, or a theme editor. Composer has no Liquid renderer, no theme API client and no store connection. A theme is also the wrong shape for Composer's own admin: theme content lives in Shopify, and Composer's EmDash admin would be a second place to edit the same marketing copy, which is a maintenance defect rather than a feature.

**Verdict: adjacent tooling only. No theme replacement, no theme hosting.** The realistic offering is "use Composer's asset and inspection tools before you touch the theme", not "build your theme in Composer".

**Owner:** no new issue. Asset work belongs to Launch Kit; inspection to Link Check.

### 5.2 Merchant-specific custom app / agency integration

This is the closest genuine overlap, and it splits in two.

**(a) Embedded app inside the Shopify admin.** Technically possible: the iframe model allows any web framework, and an Astro/EmDash Worker could serve it. Practically awkward:

- Embedded apps authenticate with token exchange and an ID token verified from App Bridge. Composer's admin authenticates with EmDash sessions and Cloudflare Access. Making one serve the other is unbuilt and untested (unverified).
- Shopify's design expectations are Polaris web components and App Bridge chrome. EmDash's admin is its own design system.
- The merchant ends up with two admins and two identities unless the embedded surface is deliberately thin.

The defensible version is therefore **a thin embedded surface plus EmDash as the back office**, or **no embedding at all**.

**(b) Standalone app outside the admin.** This is the natural Composer shape: authorization code grant, its own UI, its own data, its own release process. The cost is adoption: the merchant's staff must remember to visit another site, and Shopify's admin already shows orders, fulfilment and customer context.

**Where Composer genuinely wins in this job:** the operator is an agency or an owner-operator, not a merchant's staff. Per-client instances, pinned source, rollback, a review record and a portable specification are real work that Shopify CLI does not attempt. Composer's proposal workflow records who approved what, against which digest, with execution explicitly not performed. That is a governance artefact a client can audit.

**Prerequisites:** [#293](https://github.com/loftwah/app-composer/issues/293) for store connection and scopes; [#291](https://github.com/loftwah/app-composer/issues/291) for credential lifecycle; [#198](https://github.com/loftwah/app-composer/issues/198) for native admin; [#257](https://github.com/loftwah/app-composer/issues/257) for access boundaries.

### 5.3 Extension and workflow developer

**What Shopify already solves, completely.** Extension scaffolding, local dev with a tunnel, deployment to Shopify, versioning, review where required, and the runtimes themselves. Checkout UI extensions, admin extensions, customer account extensions and Functions all run on Shopify's infrastructure.

**What Composer can do.** Generate code for an extension, and host the *backend* an extension calls. That second part is real: a checkout extension with `network_access` can call a Composer Worker, and a webhook consumer can be a Composer Worker. But hosting a backend for an extension is not the same as hosting the extension.

**What it cannot do.** Register, deploy, version or review an extension. Those are Shopify CLI operations against Shopify's app version model ([app extensions](https://shopify.dev/docs/apps/build/app-extensions)). Composer also cannot host a Function: Functions are WebAssembly modules invoked by Shopify, never by URL.

**Verdict: code generation and backend hosting only.** Any Composer claim about "shipping a checkout extension" would be false. The honest phrasing is "your agent can draft the extension; Shopify CLI deploys it".

**Plan trap to surface:** checkout UI extensions for the information, shipping and payment steps are Plus-only, and custom apps containing Functions are Plus-only. A merchant on Basic, Grow or Advanced cannot use the thing an agency might propose.

### 5.4 Headless and composable developer

**What Shopify already solves.** Storefront API, Customer Account API, cart, checkout handoff, Markets, analytics, and Hydrogen's primitives. Hydrogen's own docs are explicit that you still own UI, routing, session storage, account pages and SEO.

**Where Composer might fit.** Three narrow cases:

1. **A content-led site that sells a small number of products.** EmDash content plus cart permalinks or Buy Button is proportionate. A full headless build is not.
2. **A separate experience on another domain** that needs its own content model and moderation (a campaign, an event, a community page) and hands off to Shopify checkout.
3. **A merchant already committed to Astro and Cloudflare** who wants EmDash content in the same deployment. Even here, Hydrogen's core works in Astro and on Cloudflare Workers, so Composer's advantage is EmDash, not the runtime.

**Where it does not fit.** High-volume catalogue and product-detail rendering. EmDash's own Cloudflare guide warns that server-rendered requests make several D1 round trips and recommends Targeted Placement near the D1 primary ([EmDash on Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/)). Shopify's theme CDN and Oxygen exist to solve storefront delivery. Composer would be adding a database to the hot path of a storefront and calling it architecture.

**Verdict: no general headless storefront. Content-led companion with checkout handoff, yes.**

### 5.5 The jobs Shopify does not sell

This is where the actual product is.

| Job | Why Shopify does not cover it | Composer's honest contribution | Status |
| --- | --- | --- | --- |
| Moderated community or guestbook beside a store | Shopify has no moderation queue for user-generated content; a theme app extension cannot own the queue | Guestbook already implements submission, private pending media, approval, hiding and source revocation | Shipped |
| Curated link/profile page fed by approved content | Not a Shopify surface | Linkarooie reads eligible Guestbook items through a versioned contract and removes cards when the source is hidden | Shipped |
| Owner enquiry/ops inbox joining Shopify order state with non-Shopify signals | Shopify admin shows orders; it does not join them to a club enquiry, an event booking or a campaign brief | Inbox + Orders fixture model + workflows + owner notifications; order state would be read-only from Shopify | Partly shipped, Shopify read not shipped |
| Per-client agency portfolio with pinned source and review records | Shopify CLI and Git give a developer a repo, not a client-auditable operating record | Workspaces, source pins, rollback, agent proposals with digest and reviewer | Shipped locally/partly deployed |
| Content and asset companion for a campaign | A theme section can hold copy; it cannot own a content model, media rights and a review trail | EmDash collections, media library, Launch Kit assets, Link Check inspection | Shipped |
| Migration companion | Shopify's import tools handle products/customers; they do not handle a companion site's content | EmDash content model and WordPress migration work ([#165–#168](https://github.com/loftwah/app-composer/issues/165)) | Separate programme, partially demonstrated |

The common shape: **content + review + ownership + a small number of integrations.** Not carts, not checkout, not fulfilment.

---

## 6. Decision matrix

Status key: **Shipped** = exists in this repository and has been exercised; **Proposed** = owned by an open issue, no code; **Blocked** = would otherwise be proposed but needs authority, credential or platform capability not held; **No fit** = Shopify owns the surface or the runtime.

| Job | What official Shopify already solves | Composer path | Status | Prerequisites | Operating burden | Competitive benefit | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Theme build and customisation | Scaffold, preview, push, Theme Check, editor, app blocks | None. Asset generation and inspection only | **No fit** | — | — | None; a theme is cheaper and better supported | — |
| Add dynamic content into a theme | Theme app extension, app proxy | App proxy-style Worker, or a Composer microsite on its own domain | **Blocked** (needs app install and `write_app_proxy` authority) | App install, `write_app_proxy`, app review if public | Two systems to keep in sync; no cookies through the proxy | Modest: only if the content model and moderation are the point | none yet |
| Merchant-specific embedded admin app | Shopify CLI, React Router template, App Bridge, Polaris, token exchange | Astro/EmDash admin plus a thin embedded surface, or standalone | **Blocked** on [#293](https://github.com/loftwah/app-composer/issues/293)/[#291](https://github.com/loftwah/app-composer/issues/291) | App creation, scopes, token exchange, App Bridge verification | Two admins, two identities, App Bridge upkeep | Governance and source ownership for the agency; little for merchant staff | [#293](https://github.com/loftwah/app-composer/issues/293), [#291](https://github.com/loftwah/app-composer/issues/291) |
| Standalone custom app (single merchant) | Authorization code grant, Admin API | Full Composer app with EmDash admin | **Blocked** on [#293](https://github.com/loftwah/app-composer/issues/293) | App credentials, scopes, webhook verification, data retention policy | Merchant staff must leave the admin | Real: owned source, review trail, content model | [#293](https://github.com/loftwah/app-composer/issues/293) |
| Public multi-merchant app | Review, billing, protected customer data, compliance webhooks, distribution | None | **No fit (now)** | App review, Shopify billing, privacy programme | Support, SLAs, incident response, API version cadence | None that Composer can currently evidence | — |
| Checkout UI extension | Shopify-hosted sandbox, CLI deploy, checkout editor | Generate code only | **No fit** | Plus for info/shipping/payment targets | Shopify owns the runtime | None | — |
| Shopify Functions | Shopify-invoked WASM, CLI deploy | Generate code only | **No fit** | Plus for custom apps with Functions | Shopify owns the runtime | None | — |
| Read-only order follow-up in an owner back office | Shopify admin, mobile admin, order APIs | Read-only order card in Composer Orders, linked to Shopify | **Blocked** on [#293](https://github.com/loftwah/app-composer/issues/293) | Dev store, read scopes, HMAC verification, reconciliation | Duplicate surface unless joined to non-Shopify work | Real when joined to enquiries, events or fulfilment exceptions | [#293](https://github.com/loftwah/app-composer/issues/293) |
| Campaign or companion microsite with Shopify checkout | Theme section, Buy Button, Storefront Web Components, cart permalinks | Composer page with cart-permalink handoff | **Primitives shipped, combination unproven** | A variant ID and a shop domain; no token | Content and domain upkeep | High for the cost: no headless build, Shopify keeps tax/shipping/checkout | E1 in §11 |
| Headless storefront (catalogue, cart, accounts) | Hydrogen on Oxygen or any runtime, Storefront API, Customer Account API | Astro/EmDash storefront | **No fit** | Storefront token, Customer Account client, SEO/perf/a11y work | Full storefront ownership | None over Hydrogen, which also runs on Astro and Cloudflare | — |
| Moderated community/content beside a store | Nothing equivalent | Guestbook + Linkarooie, composed | **Shipped** | Hosting, moderation owner, media policy | Moderation labour, media retention | High: no Shopify equivalent for this exact job | existing apps |
| Agency portfolio governance | Git and CLI, no client-facing operating record | Workspaces, source pins, rollback, agent proposals | **Shipped locally; production partly gated** | Access admission, hosted MCP, owner acceptance | Review discipline | Real and differentiated | [#311](https://github.com/loftwah/app-composer/issues/311), [#315](https://github.com/loftwah/app-composer/issues/315) |

---

## 7. Concrete good-fit use cases

Each of these passes both the surface test and the deletion test.

### 7.1 The companion back office

A rowing club, running club or small retailer sells through Shopify and also runs events, volunteers, enquiries and a photo wall. Shopify holds orders; it does not hold the volunteer roster, the enquiry triage or the moderated photo wall.

Composer hosts one operator app: enquiries inbox, event notices, volunteer capacity, moderation queue, and a read-only "recent orders needing attention" card that links into Shopify. The owner reviews everything in one place; nothing writes to Shopify in the first version.

Why it wins: the work is genuinely outside Shopify, the user is an operator, and the value is the join between commerce exceptions and non-commerce context. [#293](https://github.com/loftwah/app-composer/issues/293) is the enabling issue, and the read-only scope keeps the risk low.

### 7.2 The campaign page that hands off to checkout

A limited product drop or an event ticket needs a page with a story, a gallery, a moderation queue for customer photos and a buy action. A theme section can hold the copy but not the moderation or the content model.

Composer hosts the page; the buy button is a **cart permalink** to the store's checkout with the variant pre-loaded ([cart permalinks](https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks)). No Storefront API token, no app install, no headless build. Shopify keeps tax, shipping, discounts, payment methods and order ownership.

Known limits to state up front: cart permalinks do not work with selling plans and cannot bypass a storefront password.

### 7.3 The agency client portfolio

An agency runs twelve small client apps. Each has its own repository, D1 database, R2 bucket, domain and release. The agency needs to show a client what changed, who approved it, and how to roll back.

Composer's workspace membership, source pins, rollback and proposal records give that. Shopify CLI gives the developer a workflow; it does not give the client an auditable record. This is the most defensible commercial story in the set, and it is not a Shopify feature at all.

### 7.4 The pre-theme toolchain

Before a theme change ships: Launch Kit generates icons, PWA assets and social images; Link Check inspects the live URL for icons, share images, metadata, headings and image descriptions; the agent drafts the section copy and the alt text.

This is a real workflow with no Shopify API dependency, and it is already shipped. It should be described as "prepare the change", never as "build the theme".

### 7.5 What "multi-app portfolio" should mean here

Composer can genuinely run several independent apps for one owner, each with its own data and release. What it cannot yet do is install an arbitrary third-party app into a composition: `composition.lock.json` pins exactly two reviewed apps with a manifest contract. Any claim of a general app ecosystem is unsupported.

---

## 8. No-fit cases

1. **Replacing or reimplementing checkout.** Shopify owns checkout, its payment logic and its compliance surface. Checkout UI extensions are Plus-gated for the main steps; `checkout.liquid` is unsupported for information, shipping and payment, and was sunset for the thank-you and order-status pages on 28 August 2025, with script tags on those pages ending for non-Plus stores on 26 August 2026 ([checkout](https://shopify.dev/docs/apps/build/checkout)). A Composer checkout would also create a second payment path for a Shopify order, which is the exact double-charge failure [#105](https://github.com/loftwah/app-composer/issues/105) forbids.
2. **A general headless storefront.** Hydrogen already runs in Astro and on Cloudflare Workers. Shopify's own guidance is that headless costs more and needs developers after launch.
3. **Deep native admin parity.** Polaris, App Bridge, admin action and block extensions, and the admin's own navigation are Shopify's. A second admin that imitates them will always lag.
4. **Public multi-merchant app distribution.** Review, billing, protected customer data, mandatory compliance webhooks and API-version upkeep are a programme, not a feature.
5. **A Shopify Functions runtime or extension host.** Shopify invokes Functions; nobody else can.
6. **High-volume storefront rendering.** Adding D1 round trips to product pages is a regression against a theme CDN or Oxygen.
7. **A theme editor or Liquid IDE.** Composer has no Liquid parser, no theme API client and no preview.
8. **An "App Store listing" for a Composer mini-app.** Composing a mini-app does not create a Shopify app. There is no app record, no version, no scope grant and no review.

---

## 9. Adoption blockers

### 9.1 Platform and permission

| Blocker | Detail | Effect |
| --- | --- | --- |
| No Shopify adapter | No client, OAuth, webhook verification or scope handling in this repository | Every Shopify story is blocked on [#293](https://github.com/loftwah/app-composer/issues/293) |
| Distribution is irreversible | Custom vs public is chosen once | A custom app that succeeds cannot become a public app without a rebuild |
| Plan gating | Checkout UI extension main steps need Plus; Functions in custom apps need Plus; the pricing comparison lists "Limited" checkout customisation on Basic, "Limited data access" on Basic, and headless storefronts as 1 below Plus and 25 on Plus | Agencies must check the merchant's plan before proposing anything |
| Protected customer data | Level 2 needs review for public apps, and can trigger a data protection review | Order/customer display is not a casual feature |
| Compliance webhooks | Mandatory for App Store apps; invalid HMAC must return 401; action within 30 days | Any public app needs an erasure pipeline before launch |
| API cadence | Quarterly versions, minimum 12 months support, 2026-10 latest stable until 16 October 2027; unsupported resources can get an app delisted | A maintained integration needs a quarterly review habit |
| Rate limits | GraphQL Admin 100/200/1000/2000 points per second by plan; single query capped at 1,000 points; array inputs capped at 250; pagination capped at 25,000 | Bulk sync and dashboards need cost-aware design, not naive polling |
| Webhook reality | Ordering is not guaranteed and delivery is not guaranteed; reconciliation jobs are required | "We got the webhook" is not state truth |
| App proxy limits | One route per app, `write_app_proxy`, `Set-Cookie` stripped | Cookie-based sessions cannot ride the store domain |

### 9.2 Composer product gaps

| Gap | Evidence | Consequence |
| --- | --- | --- |
| No secret store or credential lifecycle | `docs/connections.md`: read-only inventory, no key values accepted | Shopify tokens have nowhere governed to live yet |
| No hosted multi-tenant onboarding | `PRODUCT.md`, `docs/STATUS.md` | Each customer is an operator project, not a signup |
| Agent execution is not performed | `docs/agent-proposals.md` | The proposal channel is governance, not automation |
| Hosted MCP unproven | Same document: EmDash MCP driven locally, not against a deployed instance | Do not promise a hosted agent endpoint |
| Recovery incomplete | [#117](https://github.com/loftwah/app-composer/issues/117)/[#118](https://github.com/loftwah/app-composer/issues/118) | Data and media restore is not a finished claim |
| Commerce is fixtures | `docs/orders.md` | No order, payment or fulfilment claim is available |
| Composition is a reviewed pair | `composition.lock.json` | No general third-party app installation |

### 9.3 Commercial and trust

- **Two bills.** Shopify plan plus Workers Paid plus storage plus agent usage plus maintenance. Workers Paid starts at **US$5/month** minimum with 10 million requests and 30 million CPU-ms included, then usage charges ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)). Shopify's Australian pricing page on 2026-10-25 listed Basic at A$50–56/month, Grow A$134–149, Advanced A$519–575 and Plus from A$3,700/month. Those are entry prices, not project costs, and they vary by region (unverified outside AU).
- **Headless is the expensive branch.** Shopify says so directly. Composer should not sell it as a saving.
- **Two admins.** Every embedded-app design adds an admin the merchant did not ask for.
- **Trust.** A merchant's order data is protected customer data. "An agent built it" is not an assurance argument. The review trail helps; it does not replace a privacy programme.
- **No demand evidence.** No merchant or agency has been interviewed for this report. Willingness to pay is unknown.

---

## 10. Economics, stated carefully

No total-cost claim is made. The components are:

| Component | Current published basis | Notes |
| --- | --- | --- |
| Shopify plan | A$50–56 Basic, A$134–149 Grow, A$519–575 Advanced, from A$3,700 Plus (monthly/yearly, AU page, 2026-10-25) | Region-dependent; Plus is the gate for several extension and Function paths |
| Workers Paid | US$5/month minimum; 10M requests and 30M CPU-ms included, then US$0.30/M requests and US$0.02/M CPU-ms | Static asset requests are free and unlimited |
| D1 | 25B rows read and 50M rows written included, then US$0.001/M reads and US$1.00/M writes; 5 GB storage included, then US$0.75/GB-month | EmDash server rendering does several D1 round trips per request |
| R2 | 10 GB-month free; US$0.015/GB-month standard; no egress charge | Media and backups share the bucket |
| Agent / model usage | Not published by Composer | Unknown and unbounded by design; must be budgeted per project |
| Maintenance | Not priced | API version review, dependency updates, moderation labour, support |

The honest framing for any public page: **Workers Paid is an entry price, not a project bill**, and a Shopify plan is already being paid before Composer is involved. Composer's incremental value has to exceed the incremental cost of a second system, which is why the companion framing matters more than the storefront framing.

---

## 11. Five falsifiable next experiments

All are read-only or development-store scoped. None authorises a purchase, an install on a live store, an app submission or a deployment.

### E1. Cart-permalink handoff (cheapest, do first)

**Job:** a Composer-hosted page sells one variant through Shopify checkout.

**Method:** one Composer page with a variant ID and a `https://{shop}/cart/{variant}:1` link to a development store. No app, no token, no scope. Verify first that the variant is published to the storefront channel the permalink uses; that prerequisite is not documented on the cart-permalink page and must be confirmed in the development store.

**Pass:** the buyer lands in Shopify checkout with the correct line item and quantity; the page's copy and images are editable in EmDash; time from brief to working page is recorded.

**Fail:** a theme section or Buy Button produces the same result faster, or the handoff loses attribution the merchant needs.

**Why it is falsifiable:** it produces a number (time to working cart) and a binary (correct line item or not).

### E2. App proxy versus separate domain

**Job:** decide whether companion content must live under the store's domain.

**Method:** configure one app proxy to a Composer Worker, render a simple page, and compare with the same page on its own domain. Record what breaks: cookies, redirects, assets, analytics, SEO.

**Pass:** proxy gives a materially better buyer or SEO outcome that justifies the app install and `write_app_proxy` scope.

**Fail:** no measurable difference, or the stripped `Set-Cookie` makes the experience worse. Then drop the proxy path permanently.

### E3. Read-only order companion

**Job:** show a merchant's recent orders needing attention in the Composer Inbox, joined to a non-Shopify signal.

**Method:** development store, read-only scopes, one order-status card, HMAC-verified webhook, duplicate/reorder/delayed delivery tests, and a reconciliation read. No write scope, no fulfilment, no charge.

**Pass:** one order needing attention creates one linked Inbox item; duplicate and out-of-order deliveries produce one outcome; a revoked token shows a dated last-known state.

**Fail:** protected customer data or scope approval blocks read-only order display, or the card duplicates what the Shopify admin already shows without adding the non-Shopify context.

### E4. Embedded admin feasibility spike

**Job:** determine the real cost of putting an EmDash-backed surface inside the Shopify admin.

**Method:** scaffold the official React Router app with Shopify CLI, implement token exchange and one Admin API read, then attempt to mount an EmDash-authenticated surface behind App Bridge. Timebox it.

**Pass:** the surface works with App Bridge session tokens and no third-party cookies in under a day of glue, with Polaris components.

**Fail:** EmDash's session model cannot satisfy App Bridge verification without a parallel auth path. Record the exact gap and default to standalone plus back office.

**Note:** expected result is fail. The value is the recorded reason, which stops the argument recurring.

### E5. Agent proposal versus plain pull request

**Job:** test whether Composer's review channel improves Shopify app changes.

**Method:** two agents make the same scoped change to a Shopify CLI app. One uses a Composer grant, briefing and proposal; the other uses a branch and a pull request. Measure reviewer time, defects caught (wrong scope, stale source, secret in diff, missing evidence) and handoff completeness.

**Pass:** the proposal channel catches at least one defect the PR path missed, or measurably reduces owner review time.

**Fail:** no difference. Then do not market governance to Shopify developers; keep it for agency client work where the audit record is the product.

---

## 12. Do not build

1. **A Liquid theme editor, preview or deploy path.** No parser, no theme API client, no Theme Check parity, and Shopify renders the result anyway.
2. **A checkout UI replacement or a custom checkout for Shopify orders.** Plus-gated for the main steps, `checkout.liquid` sunset, and a second payment path risks double-charging an order.
3. **A Shopify Functions runtime or extension host.** Functions are Shopify-invoked WebAssembly.
4. **A public multi-merchant app distribution pipeline** (review, billing, protected customer data programme, compliance webhooks) before a single custom-distribution app works.
5. **A Polaris/App Bridge parity admin.** A second admin that imitates the Shopify admin will always lag and doubles the merchant's context switching.
6. **A general headless storefront** competing with Hydrogen on catalogue, cart and accounts. Hydrogen already runs in Astro and on Cloudflare Workers.
7. **A second order, payment or fulfilment engine for Shopify orders.** Shopify owns the order; [#105](https://github.com/loftwah/app-composer/issues/105) already forbids duplicate checkout and duplicate fulfilment.
8. **Any import of real customer or order data** into Composer before a retention, erasure and access review exists.
9. **An "App Store" or "Shopify app" listing claim** for a composed mini-app. Composition creates no Shopify app record.

---

## 13. What would change this verdict

State these plainly so a later review can overturn the report rather than argue with it.

- If Shopify ships a first-class "external back office" surface that hosts third-party admin apps outside its own admin, Composer's operator advantage narrows.
- If Hydrogen adds an EmDash-equivalent content and moderation layer, Composer's headless case disappears entirely.
- If [#293](https://github.com/loftwah/app-composer/issues/293) lands with clean read-only order display and a real webhook/reconciliation story, the companion back office moves from proposal to product.
- If an agency pays for the portfolio governance story without a Shopify integration, the commercial thesis is stronger than this report assumes and Shopify is a side door, not the front door.
- If E4 passes cheaply, the "two admins" objection weakens and embedded custom apps become viable.

## 14. Unverified

Marked explicitly, because these are the places a confident report would be tempted to overreach.

- Oxygen's price and whether it is included in Shopify plans (not checked).
- Whether Shopify mandates embedded apps for new public apps; the docs recommend embedding and describe it as the path for most apps, but no mandate was verified.
- The exact access-scope matrix per Shopify plan beyond the pricing page's "limited data access" and "full data access" wording.
- Shopify App Store review duration and approval likelihood.
- Whether an EmDash session can be adapted to App Bridge token verification without a parallel auth path (E4 exists because this is unknown).
- Any Shopify runtime behaviour, since no API call was made.
- Demand, willingness to pay and adoption for every use case in this report.
- Shopify pricing outside Australia; the AU page was used and prices vary by region.

---

## 15. Sources checked

**Shopify, fetched 2026-10-25 UTC**

- Themes: https://shopify.dev/docs/storefronts/themes
- Theme architecture: https://shopify.dev/docs/storefronts/themes/architecture
- Theme app extensions: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
- App proxies: https://shopify.dev/docs/apps/build/online-store/app-proxies
- App Home: https://shopify.dev/docs/apps/build/app-home
- App extensions: https://shopify.dev/docs/apps/build/app-extensions
- Authentication: https://shopify.dev/docs/apps/build/authentication-authorization
- Distribution: https://shopify.dev/docs/apps/launch/distribution
- Billing: https://shopify.dev/docs/apps/launch/billing
- App Store: https://shopify.dev/docs/apps/launch/app-store-review
- App Store best practices: https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- Protected customer data: https://shopify.dev/docs/apps/launch/protected-customer-data
- Privacy law compliance: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
- Webhooks: https://shopify.dev/docs/apps/build/webhooks
- Idempotent requests: https://shopify.dev/docs/api/usage/idempotent-requests
- API versioning: https://shopify.dev/docs/api/usage/versioning
- API limits: https://shopify.dev/docs/api/usage/limits
- GraphQL Admin rate limits: https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits
- Shopify CLI: https://shopify.dev/docs/api/shopify-cli
- Checkout: https://shopify.dev/docs/apps/build/checkout
- Checkout UI extensions: https://shopify.dev/docs/api/checkout-ui-extensions/latest
- Functions: https://shopify.dev/docs/apps/build/functions
- Cart permalinks: https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks
- Headless overview: https://shopify.dev/docs/storefronts/headless/overview
- Hydrogen: https://shopify.dev/docs/storefronts/hydrogen
- Hydrogen deployment: https://shopify.dev/docs/storefronts/hydrogen/deploy
- Oxygen: https://shopify.dev/docs/storefronts/hydrogen/deploy/oxygen
- Other runtimes: https://shopify.dev/docs/storefronts/hydrogen/deploy/other-runtimes
- Pricing (AU): https://www.shopify.com/pricing

**Cloudflare and EmDash, fetched 2026-10-25 UTC**

- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- EmDash docs: https://docs.emdashcms.com/
- EmDash architecture: https://docs.emdashcms.com/concepts/architecture/
- EmDash on Cloudflare: https://docs.emdashcms.com/deployment/cloudflare/

**This repository**

- `PRODUCT.md`, `docs/STATUS.md`, `docs/orders.md`, `docs/connections.md`, `docs/agent-proposals.md`, `docs/platform/field-guide.md`, `docs/workspace-access.md`, `docs/invited-members.md`
- `src/lib/apps.ts`, `src/lib/order-contract.ts`, `src/pages/guide.astro`, `composition.lock.json`, `wrangler.jsonc`, `package.json`
- Migrations `0012`–`0018`

**Owning issues**

- [#105](https://github.com/loftwah/app-composer/issues/105) commerce umbrella
- [#293](https://github.com/loftwah/app-composer/issues/293) Shopify store, checkout and order follow-up
- [#294](https://github.com/loftwah/app-composer/issues/294), [#295](https://github.com/loftwah/app-composer/issues/295), [#296](https://github.com/loftwah/app-composer/issues/296) Stripe, PayPal, Printful
- [#117](https://github.com/loftwah/app-composer/issues/117), [#118](https://github.com/loftwah/app-composer/issues/118) recovery and portability
- [#198](https://github.com/loftwah/app-composer/issues/198), [#257](https://github.com/loftwah/app-composer/issues/257), [#291](https://github.com/loftwah/app-composer/issues/291) admin, access, credentials
- [#311](https://github.com/loftwah/app-composer/issues/311), [#315](https://github.com/loftwah/app-composer/issues/315) agent proposals and role packs
- [#355](https://github.com/loftwah/app-composer/issues/355), [#360](https://github.com/loftwah/app-composer/issues/360) audience fit and publication
- [#11](https://github.com/loftwah/app-composer/issues/11) release evidence index

---

## 16. One-paragraph answer for #355 and the publication lane

**Who benefits?** Owners and agencies running a small bespoke application beside a Shopify store: a moderated community, an enquiry and event desk, a campaign page that hands off to Shopify checkout, and an agency portfolio that needs a client-auditable record of what changed. **Why not just use Shopify?** Because those jobs are not commerce and do not belong in a theme, a checkout extension or the Shopify admin. Use Shopify CLI, themes, extensions and Hydrogen for the storefront and checkout; they are better at it, and Composer cannot host any of those surfaces. **What can I try today?** Launch Kit and Link Check before a theme change, Guestbook and Linkarooie for moderated content, and a Composer page with a cart permalink for a campaign that sells one product. **What is not available?** Any live Shopify connection, order display, checkout, or app distribution. [#293](https://github.com/loftwah/app-composer/issues/293) owns that work and it has not shipped.
