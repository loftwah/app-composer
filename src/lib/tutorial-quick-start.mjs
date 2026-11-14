// Tutorial content is data: copied text and the visible prompt use the same value.
export function validateQuickStart(guide) {
  if (!guide || typeof guide.title !== 'string' || !guide.title.trim() || typeof guide.summary !== 'string' || !guide.summary.trim() || !Array.isArray(guide.prompts) || !guide.prompts.length) throw new Error('A tutorial quick start needs a title, summary and prompts.');
  if (!Array.isArray(guide.links) || !guide.links.length || guide.links.some(link => {
    if (typeof link.label !== 'string' || !link.label.trim() || typeof link.href !== 'string') return true;
    if (link.href.startsWith('/') && !link.href.startsWith('//') && !link.href.includes('\\')) return false;
    try { const url = new URL(link.href); return url.protocol !== 'https:' || Boolean(url.username || url.password); } catch { return true; }
  })) throw new Error('A tutorial quick start needs safe, labelled links.');
  const ids = new Set();
  for (const prompt of guide.prompts) {
    if (!/^[a-z][a-z0-9-]*$/.test(prompt.id) || ids.has(prompt.id) || !prompt.label?.trim() || !prompt.text?.trim()) throw new Error('Each tutorial prompt needs a unique id, label and text.');
    ids.add(prompt.id);
  }
  return guide;
}

const boundaries = `Use my own accounts and resources. Do not assume access to the example author's projects, media, Cloudflare account, credentials or provider balance. Never put secrets in prompts, logs, commits or screenshots. Ask me to perform account sign-in and approve any new charges before they happen. Preserve existing data and publication settings.`;
const studio = `Reference implementation: https://github.com/loftwah/composer-media-studio (MIT). Tutorial: https://composer.loftwah.com/media-studio/tutorial. Build story and evidence: https://composer.loftwah.com/media-studio. Read the current repository instructions, README and deployment notes; inspect and record the reviewed source commit before using it. Use the existing supported Codex or OpenCode agent and Get Ready where applicable.`;
const capability = `The independent Worker owns its D1 projects, jobs, allowance and publication records and R2 originals and outputs. Retain the single budget and job authority. Supported paths include uploads, library, Workers AI stills and reference variations; fal-backed masked fill/outpaint, cutout, upscale, image-to-video and sound; saved storyboards and browser audio mix. Song plans retain manually timed caption cues and export SRT or WebVTT; they do not automatically transcribe or burn captions into video. Keep originals and versions. Publishing and withdrawal are deliberate; any automatic first-party gallery publication requires its separate opt-in and rights confirmation. Fal features require my own funded key and an approved request. The documented fal compose route has returned a provider 403; show it as unavailable until actually proved, and do not retry paid failures or present locally finished output as an in-product render.`;
const verify = `Run the repository's focused checks and the existing guarded deployment for my owned target. Verify the deployed source identity and a real affected user journey. Check signed-out private API denial, authorised project boundaries, budget and publication/withdrawal. Show me the actual links and results, and explicitly list anything untested or blocked. Do not create a second generation queue, credential store or destructive migration.`;

export const mediaStudioQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Build an independent studio for saved images, video and sound, or adapt the workflow to an app you already own. Your Cloudflare resources hold the work; optional model providers charge for their own requests.',
  links: [{label:'See the build and evidence',href:'/media-studio'}, {label:'Studio source',href:'https://github.com/loftwah/composer-media-studio'}, {label:'Explore Share artwork',href:'https://media.loftwah.com/portfolio'}],
  prompts: [
    {id:'build',label:'Build my independent Studio',text:`Help me build and operate my own independent Media Studio. ${studio}\n\n${boundaries}\n\nCheck my supported Node and pnpm versions and Cloudflare account first. The studio needs a Worker, D1 database bound as DB, R2 bucket bound as MEDIA and Workers AI bound as AI. Set OWNER_PASSPHRASE and SESSION_SECRET securely; FAL_KEY is optional for fal-backed generation and edits. Set PUBLIC_ORIGIN to my own Studio origin and retain a sensible MONTHLY_ALLOWANCE_MICRO. WOODHOUSE_SHARE and COMPOSER_ORIGIN are optional installation settings; never copy the example installation's public showcase list or access settings by default. For optional Composer entry, configure the supported scoped bridge with BRIDGE_SECRET and Composer's MEDIA_STUDIO_BRIDGE_SECRET, plus the installation origins. Use my own names and account, apply the source migrations in order, and do not replace existing resources. ${capability}\n\n${verify}`},
    {id:'add',label:'Add Studio to my current application',text:`Help me add Media Studio capability to my existing app without overwriting its code, data, authentication or deployments. ${studio}\n\n${boundaries}\n\nFirst inspect my app, hosting, existing identity and grants, then propose the smallest integration that fits them. Prefer an independently owned Studio with its own Worker, D1 (DB), R2 (MEDIA), Workers AI (AI), OWNER_PASSPHRASE and SESSION_SECRET. FAL_KEY is optional. For a supported Composer installation, use the existing short-lived scoped handoff and BRIDGE_SECRET / MEDIA_STUDIO_BRIDGE_SECRET, with server-side current-grant checks. Do not claim a generic app has Composer grants: if no supported bridge exists, use the standalone sign-in and explain the gap. ${capability}\n\n${verify}`},
    {id:'explain',label:'Explain this implementation',text:`Explain how this Media Studio works for someone who wants to own and change it. ${studio}\n\n${boundaries}\n\nTrace a reference from upload through generation, job admission, saved output, publication and withdrawal. Explain Worker, D1, R2, Workers AI, optional fal, cost reservations, Composer's scoped access and what a project export does not include. Distinguish working behaviour, provider-dependent behaviour and the documented compose 403 from aspirations. Link the source files supporting each claim and identify anything you cannot verify. Do not change or deploy anything.`},
    {id:'make',label:'Make a still or clip from my approved reference',text:`Help me make a still or short clip in my own Media Studio from media I am allowed to reuse. ${studio}

${boundaries}

Ask which project and source I want to use and whether I want a still or a clip. Check my actual project grant and reuse permission; public visibility alone is not permission. Import the eligible original into my project or upload my own file, retaining source and credit. For a still choose a supported reference variation or masked edit; for a clip choose an available image-to-video model and duration. Show the actual provider, input, estimated cost and remaining project allowance before any paid request. Never silently use the example owner's key or balance.

For a concrete illustration of the workflow, inspect the published example: Woodhouse Share original https://woodhouse.loftwah.com/api/v1/assets/poster-study-fighter → one H3 Max Turbo five-second request → saved 5.2-second 768 × 960 MP4 → https://media.loftwah.com/p/QXaKw_fL9cZenKCg. Studio estimated US$0.24 for that historical request, not an invoice or current quote. It is generated motion from an illustration, not gameplay. This example is evidence, not a licence to import it into my project.

After my explicit approval, make at most the one requested generation. Preserve the original and each saved variant; inspect the real output in my library. If a provider fails or the outcome is unknown, retain the job and reservation and do not submit it again. Publish or export only when I choose it, with a truthful description and credit. If no paid provider is available, keep upload/library/download usable and report the limitation; do not substitute a mock. Report the source, job, estimate and output links I am authorised to see.`}
  ]
});


export const firstAppQuickStart = validateQuickStart({
  title: 'Quick start',
  summary: 'Follow your agent from an environment check to an owned Hello page, then make and verify one small change. You need a supported agent, a selected folder and access to your own GitHub and Cloudflare accounts; account and provider costs depend on your choices.',
  links: [
    { label: 'Get Ready', href: '/ready' },
    { label: 'Choose a Hello brief', href: '/init' },
    { label: 'Get Ready source', href: 'https://github.com/loftwah/app-composer/tree/main/lib/get-ready' },
  ],
  prompts: [
    { id: 'build', label: 'Build my first owned app', text: `Help me follow the App Composer first-app tutorial at https://composer.loftwah.com/learn. Use my selected folder and my own GitHub and Cloudflare accounts; do not assume access to the example owner's resources. Inspect existing files, project instructions, agent and tools first, preserving all existing work. Keep credentials out of prompts, logs, commits and screenshots. Ask me to complete unavoidable account sign-in and approve new spending or consequential permissions.

Use the current supported Get Ready path to check the actual environment and the selected account. If the reviewed private Hello starter and an authorised workers.dev destination are suitable, prepare my own copy without replacing existing files or resources. Report unsupported prerequisites rather than pretending they passed. Open Init for the Hello reference, let me choose the title, introduction and theme, and use the saved specification and handoff for the supported owned-starter update. A preview or exported spec is not a deployment.

Use the existing guarded release path and verify the exact source and changed greeting at my intended HTTPS address. Give me the repository, live URL, commands and observed result, with any blocked or untested step. The supported Hello update proves only that starter's documented settings, not arbitrary app generation, a private web page, a new domain or a complete recovery plan.` },
    { id: 'existing', label: 'Check my existing app first', text: `Inspect my selected project before proposing an App Composer journey. Preserve its code, data, configuration and publication settings. Identify its actual stack, source, intended account, deployment target and working update path; use the project's own instructions and checks. Compare those facts with https://composer.loftwah.com/learn and https://composer.loftwah.com/ready. Explain whether the supported Get Ready/Hello path fits or whether this app needs a different plan. Keep this inspection read-only: do not install tools, create repositories, change accounts, deploy or incur charges. Report evidence, unknowns and the smallest safe next step without exposing credentials.` },
    { id: 'explain', label: 'Explain the first-app journey', text: `Explain the App Composer first-app tutorial at https://composer.loftwah.com/learn for a beginner. Walk through the agent's workspace check, Get Ready, a private source repository and public HTTPS starter, the Hello brief in Init, the supported owned-starter update and the actual live verification. Explain when independently owned mini-apps or EmDash content are useful and what extra responsibilities they add. Distinguish a preview, copied prompt, source check, deployment and tested recovery. Cite current documentation and state what remains unverified. Do not change files, accounts or cloud resources.` },
  ],
});
