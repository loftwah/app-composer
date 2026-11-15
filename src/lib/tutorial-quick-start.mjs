// Tutorial content is data: copied text and the visible prompt use the same value.
export const tutorialPromptKinds = ['reproduce', 'add', 'explain', 'next'];

const placeholderPattern = /\b(?:TODO|TBD|FIXME|XXX)\b|lorem ipsum|\{\{[^}]*\}\}|<(?:your|insert)[^>]*>|\[(?:your|insert|todo)\b/i;
const promptRequirements = {
  prerequisites: /\b(?:accounts?|credentials|secrets?|resources?|prerequisites?)\b/i,
  verification: /\b(?:verif(?:y|ied|ication)|evidence|confirm|prove|proven)\b/i,
  authority: /\b(?:do not|ask me|approval|approve|permission|sign[- ]in|human)\b/i,
};

export function validateQuickStart(guide) {
  if (!guide || typeof guide.title !== 'string' || !guide.title.trim() || typeof guide.summary !== 'string' || !guide.summary.trim() || !Array.isArray(guide.prompts) || !guide.prompts.length) throw new Error('A tutorial quick start needs a title, summary and prompts.');
  const outcome = guide.outcome;
  if (!outcome || typeof outcome.built !== 'string' || !outcome.built.trim() || typeof outcome.does !== 'string' || !outcome.does.trim() || typeof outcome.result !== 'string' || !outcome.result.trim() || !Array.isArray(outcome.needs) || !outcome.needs.length) throw new Error('A tutorial quick start needs the built result, behaviour, needs and working result.');
  if (outcome.needs.length > 8 || outcome.needs.some(item => typeof item !== 'string' || !item.trim() || item.length > 120 || /[=]|:\/\//.test(item))) throw new Error('Tutorial needs are short service names, never credentials, values or links.');
  if (!Array.isArray(guide.links) || !guide.links.length || guide.links.some(link => {
    if (typeof link.label !== 'string' || !link.label.trim() || typeof link.href !== 'string') return true;
    if (link.href.startsWith('/') && !link.href.startsWith('//') && !link.href.includes('\\')) return false;
    try { const url = new URL(link.href); return url.protocol !== 'https:' || Boolean(url.username || url.password); } catch { return true; }
  })) throw new Error('A tutorial quick start needs safe, labelled links.');
  const ids = new Set();
  const labels = new Set();
  const texts = new Set();
  for (const prompt of guide.prompts) {
    if (!/^[a-z][a-z0-9-]*$/.test(prompt.id) || ids.has(prompt.id) || !prompt.label?.trim() || !prompt.text?.trim()) throw new Error('Each tutorial prompt needs a unique id, label and text.');
    if (!tutorialPromptKinds.includes(prompt.kind)) throw new Error(`Tutorial prompt ${prompt.id} needs a supported kind.`);
    if (labels.has(prompt.label.trim())) throw new Error(`Tutorial prompt ${prompt.id} repeats another label.`);
    if (prompt.text !== prompt.text.trim()) throw new Error(`Tutorial prompt ${prompt.id} must not start or end with whitespace; copied text has to match the visible panel.`);
    if (prompt.text.length < 500) throw new Error(`Tutorial prompt ${prompt.id} is too short to stand alone.`);
    if (placeholderPattern.test(prompt.text)) throw new Error(`Tutorial prompt ${prompt.id} contains a placeholder.`);
    if (texts.has(prompt.text)) throw new Error(`Tutorial prompt ${prompt.id} duplicates another prompt.`);
    for (const [name, pattern] of Object.entries(promptRequirements)) {
      if (!pattern.test(prompt.text)) throw new Error(`Tutorial prompt ${prompt.id} must state its ${name} and boundaries.`);
    }
    ids.add(prompt.id);
    labels.add(prompt.label.trim());
    texts.add(prompt.text);
  }
  return guide;
}

const boundaries = `Use my own accounts and resources. Do not assume access to the example author's projects, media, Cloudflare account, credentials or provider balance. Never put secrets in prompts, logs, commits or screenshots. Ask me to perform account sign-in and approve any new charges before they happen. Preserve existing data and publication settings.`;
const studio = `Reference implementation: https://github.com/loftwah/composer-media-studio (MIT). Tutorial: https://composer.loftwah.com/media-studio/tutorial. Build story and evidence: https://composer.loftwah.com/media-studio. Read the current repository instructions, README and deployment notes; inspect and record the reviewed source commit before using it. Use the existing supported Codex or OpenCode agent and Get Ready where applicable.`;
const capability = `The independent Worker owns its D1 projects, jobs, allowance and publication records and R2 originals and outputs. Retain the single budget and job authority. Supported paths include uploads, library, Workers AI stills and reference variations; fal-backed masked fill/outpaint, cutout, upscale, image-to-video and sound; saved storyboards and browser audio mix. Song plans retain manually timed caption cues, export SRT or WebVTT, and a matching saved storyboard can burn those saved captions into a local MP4 on a compatible device; there is no automatic transcription. Keep originals and versions. Publishing and withdrawal are deliberate; any automatic first-party gallery publication requires its separate opt-in and rights confirmation. Fal features require my own funded key and an approved request. The documented fal compose route has returned a provider 403; show it as unavailable until actually proved, and do not retry paid failures or present locally finished output as an in-product render.`;
const verify = `Run the repository's focused checks and the existing guarded deployment for my owned target. Verify the deployed source identity and a real affected user journey. Check signed-out private API denial, authorised project boundaries, budget and publication/withdrawal. Show me the actual links and results, and explicitly list anything untested or blocked. Do not create a second generation queue, credential store or destructive migration.`;

export const mediaStudioQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Build an independent studio for saved images, video and sound, or adapt the workflow to an app you already own. Your Cloudflare resources hold the work; optional model providers charge for their own requests.',
  outcome: {
    built: 'An independent Media Studio Worker with its own D1 database, R2 bucket, owner-only workspace and public pages.',
    does: 'Keeps project originals and versions, makes stills and short clips with Workers AI and optional fal, saves storyboards, mixes browser audio and publishes deliberately.',
    needs: ['Cloudflare account with Workers Paid', 'Own D1, R2 and Workers AI bindings', 'Supported Codex or OpenCode agent', 'Optional funded fal.ai key'],
    result: 'A deployed studio at your own origin where uploads, the library, a still or saved storyboard and public pages work. Paid provider paths are claimed only when funded, run and observed.',
  },
  links: [{label:'See the build and evidence',href:'/media-studio'}, {label:'Studio source',href:'https://github.com/loftwah/composer-media-studio'}, {label:'Explore Share artwork',href:'https://media.loftwah.com/portfolio'}],
  prompts: [
    {id:'build',kind:'reproduce',label:'Build my independent Studio',text:`Help me build and operate my own independent Media Studio. ${studio}\n\n${boundaries}\n\nCheck my environment and Cloudflare account first. The current Studio pins Node '>=22.23.5 <23 || >=24.22.3 <25 || >=26.13.1 <27' and pnpm 12.19.0. It needs Workers Paid; the IMAGES binding also needs current Cloudflare Images entitlement and billing (error 9432 is the known trap). The studio needs a Worker, D1 database bound as DB, R2 bucket bound as MEDIA and Workers AI bound as AI. Follow the pinned Wrangler configuration for Darkroom: IMAGES for reference fitting, MEDIA_OPERATION with its Durable Object migration, and APP_ARTIFACTS pointing to the same private bucket as MEDIA. Have me enter OWNER_PASSPHRASE directly; do not invent, log or retain it. Set SESSION_SECRET securely. FAL_KEY is optional for fal-backed generation and edits. Set PUBLIC_ORIGIN to my own Studio origin, set RENDER_ORIGIN, retain the '* * * * *' cron for job reconciliation, set MONTHLY_ALLOWANCE_MICRO to the cap I give you, and ask me for that allowance cap before any paid call. WOODHOUSE_SHARE and COMPOSER_ORIGIN are optional installation settings; never copy the example installation's public showcase list or access settings by default. For optional Composer entry, configure the supported scoped bridge with BRIDGE_SECRET and Composer's MEDIA_STUDIO_BRIDGE_SECRET, plus the installation origins; confirm those Composer-side settings exist in the target deployment, otherwise use the standalone passphrase route and mark Composer entry untested. Ask me for the repository, Cloudflare account, Studio origin and domain, D1/R2/Worker names and allowance. Remove the example account_id, route, D1 ID and PUBLIC_SHOWCASE_SLUGS. Use the exact reviewed commit named by the Init handoff you are given; if none is named, use 'e8b3778cd5d800378f42985afda80820fcb7ef57' and record it, and do not mix a legacy brief pin with current capability claims. Apply migrations 0001–0019 in order, deploy with 'pnpm run deploy -- --migrate', and do not replace existing resources. ${capability}\n\n${verify}`},
    {id:'add',kind:'add',label:'Add Studio to my current application',text:`Help me add Media Studio capability to my existing app without overwriting its code, data, authentication or deployments. ${studio}\n\n${boundaries}\n\nFirst inspect my app, hosting, existing identity and grants, then propose the smallest integration that fits them. Prefer an independently owned Studio with its own Worker, D1 (DB), R2 (MEDIA), Workers AI (AI), OWNER_PASSPHRASE and SESSION_SECRET. FAL_KEY is optional. For a supported Composer installation, use the existing short-lived scoped handoff and BRIDGE_SECRET / MEDIA_STUDIO_BRIDGE_SECRET, with server-side current-grant checks. Do not claim a generic app has Composer grants: if no supported bridge exists, use the standalone sign-in and explain the gap. ${capability}\n\n${verify}`},
    {id:'explain',kind:'explain',label:'Explain this implementation',text:`Explain how this Media Studio works for someone who wants to own and change it. ${studio}\n\n${boundaries}\n\nTrace a reference from upload through generation, job admission, saved output, publication and withdrawal. Explain Worker, D1, R2, Workers AI, optional fal, cost reservations, Composer's scoped access and what a project export does not include. Distinguish working behaviour, provider-dependent behaviour and the documented compose 403 from aspirations. Link the source files supporting each claim and identify anything you cannot verify. Do not change or deploy anything.`},
    {id:'make',kind:'next',label:'Make a still or clip from my approved reference',text:`Help me make a still or short clip in my own Media Studio from media I am allowed to reuse. ${studio}

${boundaries}

Ask which project and source I want to use and whether I want a still or a clip. Check my actual project grant and reuse permission; public visibility alone is not permission. Import the eligible original into my project or upload my own file, retaining source and credit. For a still choose a supported reference variation or masked edit; for a clip choose an available image-to-video model and duration. Show the actual provider, input, estimated cost and remaining project allowance before any paid request. Never silently use the example owner's key or balance.

For a concrete illustration of the workflow, inspect the published example: Woodhouse Share original https://woodhouse.loftwah.com/api/v1/assets/poster-study-fighter → one H3 Max Turbo five-second request → saved 5.2-second 768 × 960 MP4 → https://media.loftwah.com/p/QXaKw_fL9cZenKCg. Studio estimated US$0.24 for that historical request, not an invoice or current quote. It is generated motion from an illustration, not gameplay. This example is evidence, not a licence to import it into my project.

After my explicit approval, make at most the one requested generation. Preserve the original and each saved variant; inspect the real output in my library. If a provider fails or the outcome is unknown, retain the job and reservation and do not submit it again. Publish or export only when I choose it, with a truthful description and credit. If no paid provider is available, keep upload/library/download usable and report the limitation; do not substitute a mock. Report the source, job, estimate and output links I am authorised to see.`}
  ]
});


export const firstAppQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Follow your agent from an environment check to an owned Hello page, then make and verify one small change. You need a supported agent, a selected folder and access to your own GitHub and Cloudflare accounts; account and provider costs depend on your choices.',
  outcome: {
    built: 'A Hello page in your own private starter, then one title, introduction and theme change on a public HTTPS address you own.',
    does: 'An agent checks your environment, you choose a Hello brief in Init, the agent applies the supported update and you compare the live page with the saved specification.',
    needs: ['Codex on an Apple Silicon Mac for the supported path', 'Node 22, 24 or 26 and Git', 'GitHub account', 'Cloudflare account', 'Agent approval for any new spending'],
    result: 'Your own repository, a workers.dev HTTPS starter, the verified Hello change and the exact source revision the agent observed.',
  },
  links: [
    { label: 'Get Ready', href: '/ready' },
    { label: 'Choose a Hello brief', href: '/init' },
    { label: 'Get Ready source', href: 'https://github.com/loftwah/app-composer/tree/main/lib/get-ready' },
  ],
  prompts: [
    { id: 'build', kind: 'reproduce', label: 'Build my first owned app', text: `Help me follow the App Composer first-app tutorial at https://composer.loftwah.com/learn. Use my selected folder and my own GitHub and Cloudflare accounts; do not assume access to the example owner's resources. Inspect existing files, project instructions, agent and tools first, preserving all existing work. Keep credentials out of prompts, logs, commits and screenshots. Ask me to complete unavoidable account sign-in and approve new spending or consequential permissions.

Use the current supported Get Ready path to check the actual environment and the selected account. If the reviewed private Hello starter and an authorised workers.dev destination are suitable, prepare my own copy without replacing existing files or resources. Report unsupported prerequisites rather than pretending they passed. Open Init for the Hello reference, let me choose the title, introduction and theme, and use the saved specification and handoff for the supported owned-starter update. A preview or exported spec is not a deployment.

Use the existing guarded release path and verify the exact source and changed greeting at my intended HTTPS address. Give me the repository, live URL, commands and observed result, with any blocked or untested step. The supported Hello update proves only that starter's documented settings, not arbitrary app generation, a private web page, a new domain or a complete recovery plan.` },
    { id: 'existing', kind: 'add', label: 'Check my existing app first', text: `Inspect my selected project before proposing an App Composer journey. Preserve its code, data, configuration and publication settings. Identify its actual stack, source, intended account, deployment target and working update path; use the project's own instructions and checks. Compare those facts with https://composer.loftwah.com/learn and https://composer.loftwah.com/ready. Explain whether the supported Get Ready/Hello path fits or whether this app needs a different plan. Keep this inspection read-only: do not install tools, create repositories, change accounts, deploy or incur charges. Report evidence, unknowns and the smallest safe next step without exposing credentials.` },
    { id: 'explain', kind: 'explain', label: 'Explain the first-app journey', text: `Explain the App Composer first-app tutorial at https://composer.loftwah.com/learn for a beginner. Walk through the agent's workspace check, Get Ready, a private source repository and public HTTPS starter, the Hello brief in Init, the supported owned-starter update and the actual live verification. Explain when independently owned mini-apps or EmDash content are useful and what extra responsibilities they add. Distinguish a preview, copied prompt, source check, deployment and tested recovery. Cite current documentation and state what remains unverified. Do not assume access to the example owner's projects or credentials. Do not change files, accounts or cloud resources.` },
  ],
});

const ownResources = `Use my own accounts, resources and domain. Do not assume access to the example author's projects, media, domain, credentials or provider balance. Never put a secret value in a prompt, log, commit, screenshot or configuration example; name an environment variable only when the repository already documents it.`;
const readOnly = `Keep this read-only: do not change files, accounts, data or deployments, and do not use the example owner's private projects or credentials.`;

const buildingCommitGuestbook = '019ce0d117f9f89e472a5c7642d51d85301f7fcd';
const buildingCommitShowcase = '20ef9a50c19c7a3419dc06fdae020c6a677ed5cf';

export const buildingQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Reproduce the two independent Workers behind the Guestbook and Linkarooie composition, or add the same versioned contribution contract to apps you already own. The local run needs no cloud account; a deployment uses your own.',
  outcome: {
    built: 'Two independent Cloudflare Workers: Here / there for private postcards and owner review, Linkarooie for the public profile and a separate featuring choice, joined by a versioned invitation contract.',
    does: 'Keeps a submission private until the source owner approves it, offers a send action only while the source is open, and removes the card and media when the source hides the item.',
    needs: ['GitHub', 'Cloudflare account with Workers, D1 and R2', 'Node 22, 24 or 26, pnpm and native Wrangler', 'A host browser only for the screenshot capture'],
    result: 'The five public states behave as described: pending stays private, approval publishes at source, featuring is a separate choice, hiding returns 404, and closed, paused or full never shows a dead form.',
  },
  links: [
    { label: 'Capture provenance', href: '/guides/building/provenance.json' },
    { label: 'Guestbook source change', href: `https://github.com/loftwah/app-composer-guestbook/commit/${buildingCommitGuestbook}` },
    { label: 'Linkarooie source change', href: `https://github.com/loftwah/app-composer-showcase/commit/${buildingCommitShowcase}` },
    { label: 'Configure a composition', href: '/init' },
    { label: 'Explore a fictional stack', href: '/s/fictional-trail-notes' },
  ],
  prompts: [
    { id: 'reproduce', kind: 'reproduce', label: 'Reproduce the two-app composition', text: `Goal
Build my own copy of the Guestbook + Linkarooie composition described at https://composer.loftwah.com/building, using the two pinned source revisions linked from that page. The result is two independent Cloudflare Workers, not one merged application.

Prerequisites
- My own GitHub account and my own Cloudflare account, with Workers, D1 and R2 available.
- Node 22 exactly and pnpm 12.8.1, as pinned by both repositories, with a native Wrangler install available through them. Do not substitute a different Node line.
- Both source repositories checked out at the reviewed revisions with dependencies installed, in sibling folders: '../app-composer-guestbook' at '019ce0d117f9f89e472a5c7642d51d85301f7fcd' and '../app-composer-showcase' at '20ef9a50c19c7a3419dc06fdae020c6a677ed5cf'. The local scripts copy these siblings; they do not clone them for you. Keep the sibling checkouts pristine at the pinned revisions and create your owned copies in separate folders: the lab measures the siblings' 'git rev-parse HEAD', so replacing them with your own HEAD changes what the capture report records.
- A host Playwright package and Chrome for the capture report. The contract can start without them, but the article's captured journey cannot: 'capture-journey.mjs' needs 'PLAYWRIGHT_MODULE' and a browser.
- The current README, Wrangler configuration and release instructions in both repositories. Read the binding and secret names there; do not invent them.

Greenfield behaviour
Create two new, separately owned copies of the reviewed Guestbook and Linkarooie sources, in sibling folders, then deploy them as two independent Workers. Keep their databases, media, domains and releases separate. Start with fictional records only.

For the local run, use the exact lab path: 'labs/building/start-local.sh', then 'RESOURCE_ID=build199-trail-8 INIT_SPEC=public/downloads/building-199-init-spec.json node labs/building/seed-local.mjs', then 'RESOURCE_ID=build199-trail-8 PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node labs/building/capture-journey.mjs', then 'labs/building/stop-local.sh'. The scripts use Guestbook on 'https://localhost:8788' and Linkarooie on 'https://localhost:8787', create one owned '$TMPDIR/composer-build-199.*' root, and remove that root on stop. Do not sweep other Wrangler state.

Build requirements
1. Follow the documented local path in https://github.com/loftwah/app-composer/tree/main/labs/building: start-local.sh, seed-local.mjs with the committed Init specification, capture-journey.mjs, then stop-local.sh. Use one owned temporary root and remove it afterwards.
2. Keep the versioned invitation endpoint GET /r/:resource/api/invitation. It reads the current active configuration, lets paused win over open, treats a closed postcard setting as closed, and treats a full queue as full. It returns no guest code, owner token, media or submission text.
3. Keep Linkarooie's exact source reference and its checks for provider, resource, field set, limits and contribution paths. A redirect, foreign origin or partial response is unavailable.
4. Keep owner controls that link, replace or stop an invitation for an exact saved stack instance. Refusing to enable a hidden or pending book is part of the contract.
5. Keep Linkarooie's 'ITEM_PROVIDER' service binding to the Guestbook Worker. Linkarooie has D1 ('DB') and static assets ('ASSETS'), not its own R2 bucket; only the Guestbook owns R2 for postcard media. Do not invent an R2 binding for Linkarooie.
6. Do not add photo upload to the profile, a comment thread, replies or notifications. Those are outside this composition.

Verification
Run each app's own test suite and keep contract tests for malformed responses, a foreign origin, changed limits, a hidden book and the open, paused, closed and full states. Run the local journey and check that a pending note is absent from the profile, approval makes it public at the source, featuring is a separate choice, hiding removes the card and returns 404 for the item and media, and every closed state renders no send action. Keep the capture report.

Release and live acceptance
Deploy only after I approve the hostnames and accounts. Because the reviewed 'wrangler.jsonc' files hardcode the example account, hostnames and identity variables, commit the required changes before deploying: 'account_id', routes, D1 IDs, the 'ITEM_PROVIDER' service, and every 'vars' entry that names the example origin or owner. Guestbook: 'PUBLIC_ORIGIN', 'OWNER_STUDIO_URL', 'RESOURCE_ACCOUNT_ID' and 'RESOURCE_ENVIRONMENT'. Linkarooie: 'PUBLIC_ORIGIN', 'PROVIDER_ORIGIN', 'PROVIDER_MOUNT', 'PROVIDER_ID' and 'OWNER_STUDIO_URL'. Without both resource identity variables the owned contract stays unavailable. The repository deploy guard refuses a dirty tree or unpushed 'main'. Configure the Guestbook's D1 and R2 and Linkarooie's D1, assets and service binding in my own account. Verify each deployed Worker's build identity, then repeat the journey on the live hostnames and record the exact revisions you observed. A hosted guest journey needs a guest code I create and share; the local capture uses fictional data and does not. The article proves the local contract, not a hosted deployment of this feature; state that limit rather than implying it shipped.

Stop for me
Ask me to sign in to GitHub or Cloudflare, approve hostnames, create owner credentials, share a guest code for a hosted journey or spend money. Keep the local run separate from any deployment. ${ownResources}` },
    { id: 'add', kind: 'add', label: 'Add the contract to my existing apps', text: `Goal
Add the reviewed source-to-showcase contribution contract from https://composer.loftwah.com/building to two apps I already own: a Guestbook-role app that collects and moderates contributions, and a Linkarooie-role app that curates and displays them.

Prerequisites
- Inspect my existing repositories, stacks, hosting, identity, data model, bindings and release path before proposing a change.
- Use my own GitHub, Cloudflare and owner accounts.
- Read the article's contract section and both pinned source changes first. Use my existing framework and conventions where they are compatible.

Existing-project behaviour
Preserve my code, data, URLs, authentication, publication settings and owner customisations. Do not overwrite an app, replace its database or merge the two apps. Propose the smallest integration. If either app cannot expose or consume the contract without a rewrite or destructive migration, explain the gap and stop before starting it.

Build requirements
1. Add one versioned endpoint to the source app that answers whether this exact resource currently accepts a contribution. Read the current active configuration; paused, closed, full and unavailable are distinct states. Return no guest code, owner token, media or submission text.
2. Store one exact source reference in the display app: kind, version, resource and configuration. Check provider, resource, field set, limits and contribution paths on every public render. Treat a redirect, foreign origin or partial response as unavailable.
3. Render one honest public state. Only open produces a send action; the others explain the state without a dead form.
4. Keep moderation and revocation in the source app. The display app may not moderate, reply, restore or copy pending content.
5. Keep the owner control that links, replaces or stops the invitation for an exact saved instance, and refuse enabling a hidden or pending source.

Verification
Use my existing test setup. Add contract tests for malformed responses, a foreign origin, changed limits, a hidden source, a configuration advance and every public state. Exercise the journey in a preview or staging environment with fictional data: pending stays private, approval publishes at source, featuring is separate, hiding returns 404 for item and media, and closed, paused and full show no send action. Do not test against production visitor records.

Release and live acceptance
Follow my app's existing release rules and verify the exact deployed source and hostnames. Repeat the journey on the live apps with fictional data and record what you observed. Report any state you could not prove.

Stop for me
Ask me to sign in, approve permissions, authorise a schema migration, publish to a live audience or spend money. ${ownResources}` },
    { id: 'explain', kind: 'explain', label: 'Explain how the contract works', text: `Goal
Explain how the Guestbook + Linkarooie composition at https://composer.loftwah.com/building works for someone who may own or maintain it.

Prerequisites
- Read the article, both pinned source revisions and the capture provenance it links.
- Use only public source and the article's published evidence.

What to explain
Trace a visitor note from the profile to the Guestbook form, the pending private record, owner approval at source, the separate featuring choice and source revocation. Explain the versioned invitation contract, why the display app asks the source on every render, who owns records and media, and which checks reject an unavailable or mismatched source. Separate what the local run proved from what a deployment would still need to prove.

Verification
Cite the exact file, commit or capture for each claim. Mark anything you cannot verify as unknown. Do not upgrade a local emulation result into a hosted deployment or a completed recovery plan.

Boundaries
${readOnly}` },
  ],
});

export const creatorHubQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Build your own two-app Creator Hub from the reference, or add a reviewed guestbook and a curated profile to an app you already run. The live reference belongs to its operator; your build uses your own accounts and domain.',
  outcome: {
    built: 'Two independent apps: Here / there for guest postcards and owner moderation, and Linkarooie for the profile, curated links and separate featured picks.',
    does: 'Lets a visitor send a note with the guest code, keeps it private until the owner approves it, and shows an approved item only when the owner also chooses to feature it.',
    needs: ['GitHub', 'Cloudflare account with Workers and D1, plus R2 for Here / there', 'Cloudflare Access for the administrator panel', 'A hostname you control', 'An owner credential and guest code you create'],
    result: 'Two HTTPS hostnames with independent source and data, a reviewed contribution that becomes public only after approval and featuring, and an Init plan that names every agent and human step.',
  },
  links: [
    { label: 'Open the live reference', href: 'https://creator-hub.loftwah.com/' },
    { label: 'Here / there source', href: 'https://github.com/loftwah/creator-hub-guestbook' },
    { label: 'Linkarooie source', href: 'https://github.com/loftwah/creator-hub-showcase' },
    { label: 'Start this composition', href: '/init?start=creator-hub' },
  ],
  prompts: [
    { id: 'reproduce', kind: 'reproduce', label: 'Build my own Creator Hub', text: `Goal
Build my own Creator Hub with two independent apps: a moderated guestbook that accepts contributions and a Linkarooie profile that curates approved work and links. Use https://composer.loftwah.com/creator-hub and the two pinned repositories it names as the reference.

Prerequisites
- My own GitHub account, Cloudflare account and a hostname I control.
- Cloudflare Workers, one D1 database per app and an R2 bucket for the guestbook.
- Cloudflare Access for the administrator panel, an owner credential I create and a guest code I choose.
- A supported coding agent. Read each repository's current README, Wrangler configuration and release notes for the exact binding and secret names.

Greenfield behaviour
Create two new repositories and deployments from the reviewed source. Keep their Workers, D1 databases, media, configuration and releases separate. Do not merge them into one project or one database. Use fictional profile content and fictional contributions.

Build requirements
1. Configure the pair in Init at https://composer.loftwah.com/init?start=creator-hub, review the exported plan and keep its agent and human labels. Export a specification; it is a brief, not a deployment.
2. Deploy the guestbook first. The profile reads approved contributions through a service binding, so it needs a working source.
3. Keep owner moderation in the guestbook: a contribution is private until the owner approves it. Keep featuring in the profile as a separate choice.
4. Keep featured picks as a saved profile setting so they survive a release without a code fork.
5. Keep each app's owner API and data export. Do not add public signup, customer accounts or a shared owner credential.

Verification
Run each repository's own checks. Then exercise the real journey with fictional data: send a note with the guest code, confirm it is private, approve it, feature it, open the source link, hide it at source, confirm both public views stop showing it and the item and media return 404. Check signed-out access denial for owner routes and that featured picks survive a redeploy. Check the profile and guestbook at phone and desktop widths.

Release and live acceptance
Deploy to my own hostnames through each app's existing release guard. Verify the exact source revision and release identity each app reports, then repeat the journey on the live hostnames. Record the URLs, source revisions and observed results. The published Creator Hub is a reference build in the operator's account; do not claim an independent rebuild or a customer deployment from it.

Stop for me
Ask me to sign in to Cloudflare, configure Access, approve hostnames, create the owner credential and guest code, and decide that a contribution may be published. ${ownResources}` },
    { id: 'add', kind: 'add', label: 'Add this to my existing apps', text: `Goal
Add the Creator Hub capability from https://composer.loftwah.com/creator-hub to apps I already run: a moderated guestbook intake, in the Here / there role, and a curated Linkarooie-style profile with separate featured picks.

Prerequisites
- Inspect my existing apps, identity, data model, hosting, bindings, moderation states and release path.
- Use my own accounts and an authorised target. Read my apps' documented binding and secret names; do not invent them.

Existing-project behaviour
Preserve my code, data, URLs, authentication, publication settings and owner customisations. Do not overwrite an app, replace its database or merge the two apps. If my current apps lack a moderation state or an owner-review boundary, explain the gap before adding one. Prefer a small service binding contract over copying approved content between databases.

Build requirements
1. Define one exact source reference for an approved item and resolve it on each public render.
2. Keep private submissions, review, approval and revocation in the intake app. Keep curation and featuring in the profile app.
3. Add no public signup or general customer accounts. Keep owner access behind my existing invitation and permission model.
4. Store featured picks as configuration so they can change without a release.
5. Keep an export for each app that does not include credentials.

Verification
Add contract and moderation tests in my existing test setup. Exercise the journey in preview or staging with fictional data: private before approval, public after approval, featured only after a separate choice, gone from both views and 404 at the source after hiding. Check that an unauthorised or signed-out request is denied. Do not use production visitor records.

Release and live acceptance
Follow my release rules, verify the deployed source and both hostnames, then repeat the journey live with fictional data. Report anything still unproven.

Stop for me
Ask me to sign in, approve permissions, change access, authorise a migration, publish a contribution or spend money. ${ownResources}` },
    { id: 'explain', kind: 'explain', label: 'Explain the reference build', text: `Goal
Explain the Creator Hub reference at https://composer.loftwah.com/creator-hub and the two apps behind it.

Prerequisites
- Read the reference page, both pinned repositories, their build identities and the Init plan.
- Use only public source and published evidence.

What to explain
Follow the brief from a person's own words to the Here / there guestbook and the Linkarooie profile, one shared configuration and separate data. Trace an approved contribution and a featured pick through both apps. Explain who owns source, databases, media, moderation and publication, and why a code rollback is not a data restore. Separate the operator's reference build from a customer deployment, and say plainly that the page does not claim an independent owner has rebuilt it.

Verification
Cite the exact file, commit or live response for each claim, and mark anything you cannot verify as unknown. Do not treat a screenshot or a blueprint as deployment proof.

Boundaries
${readOnly}` },
  ],
});

export const paperworkQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Reproduce Paperwork, a browser-local PDF editor, or add fill-and-sign capability to an app you already own. Documents and signatures stay in the browser; the reference deployment belongs to its operator.',
  outcome: {
    built: 'A static, independently owned PDF editor with its own source, PDF libraries and deployment.',
    does: 'Fills native PDF fields, adds text, ticks, ink and a signature, edits document properties, then saves or prints one completed PDF without uploading the document.',
    needs: ['GitHub', 'Cloudflare account for the static deployment', 'Node and the pnpm version declared by the repository', 'No end-user account'],
    result: 'A served editor that opens a fictional form, fills and signs it, downloads a completed PDF with intact values and pixels, and makes no document-network request.',
  },
  links: [
    { label: 'Open Paperwork', href: 'https://paperwork.loftwah.com' },
    { label: 'Independent source', href: 'https://github.com/loftwah/app-composer-paperwork' },
    { label: 'Reviewed commit', href: 'https://github.com/loftwah/app-composer-paperwork/tree/51f96278b18732bbd2991f30eae36aaba30c9b16' },
    { label: 'Configure in Init', href: '/init/paperwork' },
    { label: 'Acceptance record', href: 'https://github.com/loftwah/app-composer/blob/main/docs/paperwork-acceptance.md' },
  ],
  prompts: [
    { id: 'reproduce', kind: 'reproduce', label: 'Reproduce Paperwork', text: `Goal
Reproduce Paperwork, the browser-local PDF editor described at https://composer.loftwah.com/paperwork, from the reviewed source at https://github.com/loftwah/app-composer-paperwork/tree/51f96278b18732bbd2991f30eae36aaba30c9b16. Use the existing Init path at https://composer.loftwah.com/init/paperwork.

Prerequisites
- My own GitHub account and my own Cloudflare account for the static deployment.
- Node and the pnpm version declared by the repository.
- No end-user account, document backend or upload storage. Do not put a real document, signature or credential in a prompt, test file or screenshot.

Greenfield behaviour
Create a new project in an absent directory from the pinned source. Do not modify an existing project. The generated target is deliberately unconfigured: remove the reference account and custom-domain routes, keep the app noindex until I review its own origin, and give it its own deployment boundary.

Build requirements
1. Use the documented reproduction command: clone the source, run pnpm init:paperwork with the source, destination and a configuration containing only title, introduction and theme, then install with a frozen lockfile.
2. Keep processing in the browser. Documents and signatures must not be uploaded, stored in the cloud, sent to analytics or passed through a provider.
3. Keep native form fields, text and tick additions, pen and highlighter, eraser, undo and redo, PNG signature placement, document properties, save and print.
4. Keep the stated limits: ordinary PDFs up to 30 MB and 100 pages; refuse password-protected, XFA and already certificate-signed documents. Do not imply those refusals are redaction or a security review.
5. Keep the completed export as one PDF with the original page content and native values preserved.

Verification
Run pnpm check, pnpm build and the repository's audit. Use the synthetic fixtures and an independent PDF reader to confirm field values, page geometry, original scan pixels and signature placement. Confirm the open, edit, sign, download and print journey makes no document-network request and leaves browser storage empty. Check phone widths, both themes and keyboard operation.

Release and live acceptance
Deploy to my reviewed target through the app's own release path. Verify the served HTML bytes, the no-transform cache header, the versioned app manifest and the exact deployed source. On the live site, fill and sign the fictional sample, download it, reopen it and compare the values and pixels. Physical print, a physical stylus and screen-reader acceptance remain separate checks; say so.

Stop for me
Ask me to sign in to GitHub or Cloudflare, choose a domain, approve spending or approve a change to the document data boundary. ${ownResources}` },
    { id: 'add', kind: 'add', label: 'Add fill and sign to my app', text: `Goal
Add browser-local PDF fill-and-sign capability from https://composer.loftwah.com/paperwork to an app I already own.

Prerequisites
- Inspect my app's stack, data model, privacy boundary, storage, authentication and release path first.
- Use my own accounts and an authorised target.

Existing-project behaviour
Preserve my code, data, URLs, authentication and publication settings. Do not silently add server-side document storage, analytics on documents or a second account system. If my app already stores documents on a server, keep that behaviour explicit and do not change its privacy model without my approval.

Build requirements
1. Choose the smallest integration: an embedded editor, a dedicated route or a separately owned static app that my app links to. Prefer the last option when the privacy model differs.
2. Keep PDF parsing, field editing, annotations, signature placement and export in the browser.
3. Use reviewed PDF libraries and their licences; do not write a partial PDF parser. Keep native fields, text and tick additions, ink, undo and redo, document properties, save and print.
4. Keep the limits and refusals: 30 MB, 100 pages, no password-protected, XFA or certificate-signed files. Show a helpful error that retains unrelated unsaved work.
5. Keep the exported PDF as normal page content plus preserved native values; do not claim redaction or removal of hidden metadata unless you implement and test it.

Verification
Add fixture-based tests for changed fields, awkward widgets, rotation, scanned pages, signatures, failures and export. Confirm no document or signature leaves the browser. Reopen the downloaded PDF in an independent reader and compare values and pixels. Check phone and keyboard use.

Release and live acceptance
Follow my release path and verify the deployed source and hostname. Exercise the real journey in the live app with a fictional form, then record what was checked and what still needs a physical device or print check.

Stop for me
Ask me to sign in, approve a new dependency, change a privacy or storage boundary, or spend money. ${ownResources}` },
    { id: 'explain', kind: 'explain', label: 'Explain how Paperwork works', text: `Goal
Explain how Paperwork at https://composer.loftwah.com/paperwork works, for someone deciding whether to own or reproduce it.

Prerequisites
- Read the public page, the pinned source revision, the versioned app manifest and the acceptance record.
- Use only public source and published evidence.

What to explain
Follow a document from open to completed download. Explain native fields versus added page content, signature placement, document properties, save and print, and why password-protected, XFA and certificate-signed files are refused. Explain what stays in the browser and what a deployment adds. Distinguish filling and signing from redaction, certificate validation or a document-management system.

Verification
Cite the exact file, test or acceptance result for each claim, and mark anything you cannot verify as unknown. Do not present the fictional sample as a legal or compliance certification.

Boundaries
Keep this read-only: do not open, upload or alter a real document, and do not change files, accounts or deployments. Do not use the example owner's private documents or credentials.` },
  ],
});

export const launchKitQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Build your own Launch Kit for profile cards, app icons and a complete launch package, or add the renderer to an app you already run. Rendering happens locally; publishing to a live profile is a separate, deliberate step.',
  outcome: {
    built: 'A static browser editor plus a pinned local Chromium renderer for versioned card recipes, app icons, maskable icons, a web manifest and an installation package.',
    does: 'Renders the exact PNG bytes you preview and download, keeps source artwork local, and can prepare one reviewed card for a Linkarooie profile.',
    needs: ['GitHub', 'Cloudflare account for the static deployment', 'Node, pnpm and a local Chromium for CLI rendering', 'Optional AI provider key for optional artwork'],
    result: 'A served editor that renders and exports a 1200 × 630 card, icons and a valid package. A published profile changes only after the owner compares and approves the new asset.',
  },
  links: [
    { label: 'Open the card editor', href: 'https://composer-launch-kit.loftwah.workers.dev/profile.html' },
    { label: 'Launch Kit source', href: 'https://github.com/loftwah/app-composer-launch-kit' },
    { label: 'Local renderer guide', href: 'https://github.com/loftwah/app-composer-launch-kit/blob/main/docs/profile-cards.md' },
    { label: 'Import a package', href: '/init/launch-kit' },
    { label: 'Try the generated timer', href: '/launch-kit/example/' },
  ],
  prompts: [
    { id: 'reproduce', kind: 'reproduce', label: 'Build my own Launch Kit', text: `Goal
Build my own Launch Kit for profile cards, app icons and a complete launch package, using the reviewed source at https://github.com/loftwah/app-composer-launch-kit and the working editor at https://composer-launch-kit.loftwah.workers.dev/.

Prerequisites
- My own GitHub account and my own Cloudflare account for the static deployment.
- Node, pnpm and a local Chromium for the CLI renderer.
- No account, upload storage, server image processing or model key is needed for normal rendering. Optional AI artwork needs an explicitly enabled trusted local adapter and my own provider key.

Greenfield behaviour
Create a new project from the reviewed source and give it its own static hostname. Do not point the new project at the reference owner's deployment or reuse their assets. Keep the reference examples in place as examples, not as approved replacement art.

Build requirements
1. Install the pinned dependencies, run the build and serve the static editor.
2. Keep the versioned profile-card recipe, the maintained renderer and the editor's exact preview-to-download bytes.
3. Keep profile cards, app icons, maskable icons, the web manifest, HTML markup and installation notes in the complete package.
4. Keep source artwork local and out of portable recipes. Reopening an image recipe may require the matching local files.
5. Keep the optional AI artwork adapter outside the public editor. A present key alone must perform zero calls; require explicit enablement, a prompt and a configured allowance.
6. Do not add accounts, uploads or server-side image generation to the static editor.

Verification
Run the repository's own checks and pnpm build. Render a fictional recipe with pnpm render public/examples/river-typography.json output/river --compare and confirm the receipt records the renderer, fonts and encoded output hashes. Check the PNG dimensions and bytes, the maskable icon safe area, the manifest and the package file list. Confirm rendering still works with external requests blocked after dependencies are available.

Release and live acceptance
Deploy to my own static host through its existing release path. Verify the served editor, the actual downloaded PNG bytes and the manifest. Recheck the reference examples only as examples. Physical installation, offline relaunch, native platform unfurls and owner artistic acceptance remain separate checks; report them as unproven rather than implied.

Stop for me
Ask me to sign in to GitHub or Cloudflare, choose a hostname, approve spending or approve optional artwork generation. ${ownResources}` },
    { id: 'add', kind: 'add', label: 'Add card and icon rendering to my app', text: `Goal
Add profile-card, icon and launch-package generation from https://composer.loftwah.com/launch-kit to an app I already own.

Prerequisites
- Inspect my app's stack, branding inputs, image handling, storage and release path.
- Use my own accounts and an authorised target.

Existing-project behaviour
Preserve my code, data, URLs, authentication, design and publication settings. Keep source images on the device and out of uploaded records unless I explicitly approve storage. Do not add a server-side image service or a public provider key to an app that did not have one.

Build requirements
1. Choose the smallest integration: link to a separately owned Launch Kit, embed the renderer or add one generation route. Prefer the separate app when my app has no image-processing boundary.
2. Keep the versioned recipe, exact preview bytes and a bounded set of outputs: profile card, icons, maskable icon, manifest and notes.
3. Keep text composition local; do not substitute a name, truncate silently or fetch a remote font without approval.
4. Keep optional AI artwork disabled by default, outside the browser and behind explicit enablement, a prompt and an allowance.
5. Do not copy reference artwork into my app as if it were approved brand material.

Verification
Render a fictional recipe with my own title and verify dimensions, PNG bytes, icon safe area, manifest and package contents. Confirm the preview and downloaded PNG are identical. Add no network request that uploads my source artwork. Check phone and desktop use of the editor.

Release and live acceptance
Follow my release path, verify the deployed source and hostname, and download the asset from the live app. Publish a generated image only after I compare it with the current one. Physical installation, native unfurls and owner artistic acceptance remain separate.

Stop for me
Ask me to sign in, approve a dependency, choose a hostname, publish an image or spend money. ${ownResources}` },
    { id: 'publish', kind: 'next', label: 'Publish one card to my profile', text: `Goal
Prepare and deliberately publish one profile card from a local recipe into my existing Linkarooie profile, using the publication path documented at https://composer.loftwah.com/launch-kit.

Prerequisites
- An existing Linkarooie checkout I am authorised to release, the selected local recipe and the rendered PNG.
- An owner session for the profile settings. Use my own accounts and do not use the reference owner's profile.

Existing-project behaviour
Preserve the current profile text, links, contributions and approved image until the new image is explicitly published. Do not overwrite an existing profile or deploy from an unreviewed branch.

Build requirements
1. Run node scripts/prepare-share-card.mjs with the recipe, PNG and output receipt in the Linkarooie checkout. It stages an immutable public/brand/generated/profile-SHA256.png and a bounded adoption receipt.
2. Review the receipt and the rendered image. Commit and deploy the asset through Linkarooie's existing clean pushed-main release; do not bypass its guard.
3. In owner settings, import the receipt, compare the current and proposed image and publish deliberately. Publish is a separate action from preparing the asset.
4. If the profile revision changed, render a fresh snapshot. Do not force the old image onto a newer profile.
5. Do not retry a failed or uncertain publication blindly. Retain the previous approved image.

Verification
Verify the deployed asset bytes, content type, decoded dimensions, SHA-256 and the exact profile revision. Open the public profile and its metadata, and confirm the served image matches the approved file. Repeat the same completed operation only when it is safe and idempotent. Do not claim that third-party caches or downloaded copies were recalled.

Release and live acceptance
Record the source revision, deployed identity, receipt, image hash and observed public response. State any platform preview you could not verify.

Stop for me
Ask me to sign in, approve the publication, change a public profile or spend money. ${ownResources}` },
  ],
});
