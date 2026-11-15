/** Task-first documentation index.
 *
 * These records describe real routes and canonical prompts only. Prompt prose
 * stays in prompt-library.ts; this file maps a plain-language task to a prompt
 * id, a supported guide and an honest limit. Nothing here executes work.
 */

export interface DocsLink {
  label: string;
  href: string;
}

export interface DocsTaskPath {
  id: string;
  /** Stable in-page anchor for the task detail. */
  anchor: string;
  /** The visitor's own wording, used as the task heading. */
  question: string;
  /** One line for the compact picker. */
  short: string;
  /** What the visitor ends up with. */
  outcome: string;
  prerequisites: string[];
  /** Canonical prompt module id from prompt-library.ts. */
  promptId: string;
  /** What that prompt asks the agent to do, in one plain sentence. */
  promptNote: string;
  /** The maintained page that supports this task. */
  guide: DocsLink & { note: string };
  next: DocsLink;
  /** Another canonical prompt for a different shape of the same task. */
  also?: DocsLink[];
  /** A real boundary, not a marketing disclaimer. */
  limit: string;
  terms: string[];
}

export const docsTaskPaths: readonly DocsTaskPath[] = [
  {
    id: 'new-to-agents',
    anchor: 'path-new',
    question: 'I’m new to AI agents',
    short: 'Get an agent and a working first environment, with or without an app idea.',
    outcome:
      'A checked setup and one HTTPS page you can open, made by the agent you chose.',
    prerequisites: [
      'An AI agent you can open in a folder on your computer. The verified setup path today is Codex on Apple Silicon macOS with Node 22, 24 or 26 and Git.',
      'A GitHub account and a Cloudflare account. The agent asks for official sign-in only when it needs it.',
      'A folder your agent may work in. You do not need an app idea yet.',
    ],
    promptId: 'setup',
    promptNote:
      'Checks the agent’s actual workspace, GitHub and Cloudflare access, prepares missing supported tools, deploys the configurable Hello reference over HTTPS and reports the exact human step when one is needed.',
    guide: {
      label: 'Open Get Ready',
      href: '/ready',
      note: 'Check the environment, read a saved progress report and see the supported setup path.',
    },
    next: { label: 'Follow the first-app tutorial', href: '/learn' },
    limit:
      'Only Codex on Apple Silicon macOS is verified end to end today. Another authorised agent can reuse the library or the optional local MCP checks; that does not certify its own installation.',
    terms: [
      'new', 'beginner', 'start', 'getting started', 'agent', 'ai agent', 'codex', 'opencode',
      'chatgpt', 'claude', 'setup', 'set up', 'install', 'github', 'cloudflare', 'account',
      'no idea', 'without an idea', 'environment', 'ready', 'first app',
    ],
  },
  {
    id: 'have-an-idea',
    anchor: 'path-idea',
    question: 'I have an idea for an app or site',
    short: 'Describe the app, validate what it needs and hand your agent a specification.',
    outcome:
      'A validated app specification and a prompt your agent can use to build one complete journey in your own project.',
    prerequisites: [
      'A folder or repository your agent may change.',
      'A working environment. If you have not set one up, start with the new-to-agents path.',
      'An idea, or the job the app should do for someone.',
    ],
    promptId: 'build',
    promptNote:
      'Asks your agent to inspect the project, reuse what exists, build one usable journey with failure recovery, and check it at real phone and desktop sizes.',
    guide: {
      label: 'Describe the app in Init',
      href: '/init',
      note: 'Choose a preset, edit real fields and export a versioned specification with the matching agent handoff.',
    },
    next: { label: 'Publish and share the result', href: '#path-publish' },
    limit:
      'Init exports a specification and handoff; it does not build or deploy anything. Your agent implements in your project and follows that project’s release rules.',
    terms: [
      'idea', 'app', 'site', 'website', 'make a site', 'build', 'create', 'new project',
      'spec', 'specification', 'init', 'homepage', 'store', 'shop', 'blog', 'portfolio',
      'application', 'first app', 'hello world', 'cloudflare worker',
    ],
  },
  {
    id: 'existing-project',
    anchor: 'path-existing',
    question: 'I already have a project',
    short: 'Have your agent inspect the real repository and recommend what is worth adopting.',
    outcome:
      'A read-only assessment of your actual project: what fits, what should stay, what would change, what it needs and the smallest reversible first step.',
    prerequisites: [
      'The project folder or repository, with uncommitted owner work preserved.',
      'The existing tests, if any, and the accounts the project already uses.',
      'Permission for a read-only inspection. Changes need your explicit go-ahead.',
    ],
    promptId: 'assess',
    promptNote:
      'Asks your agent to inspect source, trusted instructions, tests and Git state, separate supported capabilities from unverified claims, and stop before changing anything.',
    guide: {
      label: 'Read the assessment brief',
      href: '/agent',
      note: 'The same read-only request in Markdown, with the current supported, bounded and unsupported capabilities.',
    },
    next: { label: 'Make one change in the existing app', href: '/prompts#change' },
    limit:
      'The assessment is read-only. It is not a migration, a benchmark or a guarantee that a Composer capability fits your project.',
    terms: [
      'existing', 'project', 'repo', 'repository', 'wordpress', 'migrate', 'migration',
      'assess', 'assessment', 'audit', 'fit', 'github', 'inspect', 'legacy', 'keep',
      'adopt', 'adoption', 'current app', 'already built',
    ],
  },
  {
    id: 'add-something',
    anchor: 'path-add',
    question: 'Add something useful to an app',
    short: 'Editable content, a form, media or a real connection between two apps.',
    outcome:
      'One working capability in an app you already run, using that app’s own data and release rules instead of a second framework.',
    prerequisites: [
      'An app your agent can run and change.',
      'The accounts or providers that capability actually needs. Missing connections stay visible instead of being simulated.',
      'A decision about which app owns the new records.',
    ],
    promptId: 'compose',
    promptNote:
      'Asks your agent to prepare a validated composition, keep each app’s source, data and deployment independent, and exercise the cross-app action plus an unavailable-source case.',
    guide: {
      label: 'Build a content model',
      href: '/init/content',
      note: 'Author typed fields, groups and bounded repeaters, then export a native EmDash seed. Applying the model needs an authorised agent.',
    },
    next: { label: 'Publish and share what you added', href: '#path-publish' },
    also: [{ label: 'Adding editable content instead? Use the content prompt', href: '/prompts#content' }],
    limit:
      'Composer has no Instagram posting, no customer login and no one-click plugin marketplace. The closest supported routes are listed under “Not available yet”.',
    terms: [
      'add', 'content', 'form', 'media', 'photo', 'image', 'widget', 'connection', 'connect',
      'compose', 'component', 'collection', 'cms', 'editable', 'email', 'inbox', 'workflow',
      'stripe', 'paypal', 'shopify', 'printful', 'shop', 'payment', 'mini-app', 'miniapp',
      'editable content', 'contact form', 'enquiry', 'newsletter',
    ],
  },
  {
    id: 'publish-share',
    anchor: 'path-publish',
    question: 'Publish and share my app',
    short: 'Put the working result somewhere real, verify it and give people a useful link.',
    outcome:
      'A published result you checked at its real address, plus share images and a caption made from a demonstrated feature rather than a mock-up.',
    prerequisites: [
      'A working app and the release path its project already uses.',
      'The domain, Worker or host account that owns the published address.',
      'Permission to deploy. Copying a prompt does not deploy anything.',
    ],
    promptId: 'verify',
    promptNote:
      'Asks your agent to compare the result with the request, check real layouts, keyboard and error recovery, use the existing authorised release path, and record exact source and deployed identity.',
    guide: {
      label: 'Package a share kit',
      href: '/launch-kit',
      note: 'Turn a demonstrated feature into images and captions with a stable example link and matching prompt.',
    },
    next: { label: 'Improve or operate the published app', href: '#path-improve' },
    limit:
      'Composer has no automatic social publishing. A share kit prepares assets you post yourself, and copying is never the same as publishing.',
    terms: [
      'publish', 'share', 'sharing', 'deploy', 'release', 'live', 'domain', 'https', 'launch',
      'social', 'instagram', 'linkedin', 'twitter', 'card', 'seo', 'share kit', 'ship',
      'go live', 'production', 'host',
    ],
  },
  {
    id: 'improve-operate',
    anchor: 'path-improve',
    question: 'Improve, operate or fix an app',
    short: 'Check health, update dependencies, recover data or investigate a failure.',
    outcome:
      'A supported finding or fix with evidence, the exact environment it applies to, and the remaining gates instead of a guess.',
    prerequisites: [
      'The app’s source and access to the environment where the problem happens.',
      'Logs or a failing journey. Without one, the prompt starts with a read-only health check.',
      'An explicit decision about what may change, and a recovery plan before valuable data is touched.',
    ],
    promptId: 'maintain',
    promptNote:
      'Asks your agent to inspect source, configuration, data, media and access, separate code rollback from data restoration, and stay read-only unless you already authorised changes.',
    guide: {
      label: 'Open the runbooks and resources',
      href: '/resources',
      note: 'Change, incident, pipeline and hook runbooks with downloadable Markdown for the project.',
    },
    next: { label: 'Handle an incident with a bounded record', href: '/prompts#incident' },
    limit:
      'Code rollback restores an executable, not a database or deleted media. Restoration needs its own authorised, rehearsed recovery.',
    terms: [
      'improve', 'operate', 'fix', 'broken', 'bug', 'error', 'incident', 'maintain',
      'maintenance', 'update', 'upgrade', 'rollback', 'recover', 'recovery', 'slow',
      'performance', 'security', 'accessibility', 'health', 'database', 'backup',
      'failing checks', 'dependencies', 'outage', 'not working',
    ],
  },
];

export interface DocsReferenceSection {
  id: string;
  title: string;
  summary: string;
  terms: string[];
}

/** The complete technical reference now lives at /docs/how-it-works. */
export const docsReferenceSections: readonly DocsReferenceSection[] = [
  { id: 'from-an-idea', title: 'From an idea to a live app', summary: 'The four supported stages: Get Ready, Init, compose and verify.', terms: ['overview', 'workflow', 'stages', 'how it works', 'architecture'] },
  { id: 'standalone-get-ready', title: 'Get Ready works on its own', summary: 'The reusable MIT core, the independent consumer, clone and ownership operations, deployment preparation and its limits.', terms: ['library', 'cli', 'package', 'standalone', 'deploy', 'reference', 'hello', 'source', 'ownership', 'get ready'] },
  { id: 'local-get-ready-mcp', title: 'Let another agent check the same environment', summary: 'The optional local MCP adapter, host-selected workspace and read-only tool boundary.', terms: ['mcp', 'stdio', 'host', 'tool', 'integration', 'agent'] },
  { id: 'domain-diagnosis', title: 'Know what your domain needs', summary: 'Nameserver, DNSSEC and DS observation without editing DNS.', terms: ['dns', 'domain', 'nameserver', 'dnssec', 'zone', 'diagnose'] },
  { id: 'workspace-tools', title: 'Missing tools have a supported next step', summary: 'Private GitHub CLI and pnpm tools inside one project folder on the supported Mac path.', terms: ['pnpm', 'gh', 'install', 'tools', 'workspace', 'package manager', 'node'] },
  { id: 'app-settings', title: 'Give each app its own settings', summary: 'Per-app title, introduction, theme and layout settings with versioned contracts.', terms: ['settings', 'theme', 'layout', 'per app', 'version 2', 'spec'] },
  { id: 'hello-init', title: 'Turn the reference into a first app', summary: 'Apply a verified Hello title, introduction and theme to the owned starter.', terms: ['hello', 'first app', 'init', 'title', 'theme', 'worker', 'deploy'] },
  { id: 'guestbook-contributions', title: 'Let visitors leave a note', summary: 'Guestbook postcards, moderation, media and featured Linkarooie cards.', terms: ['guestbook', 'photo', 'moderation', 'contribution', 'approve', 'media'] },
  { id: 'first-composition', title: 'The first composition', summary: 'How Photo Guestbook and Linkarooie join through Worker service bindings.', terms: ['composition', 'binding', 'connect', 'compose', 'apps', 'service'] },
  { id: 'updates-and-rollback', title: 'Update without losing your work', summary: 'Pinned source updates, contract checks and code-only rollback.', terms: ['update', 'update app', 'rollback', 'version', 'migration', 'data recovery', 'source pin'] },
  { id: 'supported-boundary', title: 'The supported boundary', summary: 'What this release does and does not authorise.', terms: ['security', 'permissions', 'access', 'boundary', 'limits', 'admin', 'multi-tenant'] },
  { id: 'state-vision', title: 'Portable assistant context', summary: 'Carry / forward local encryption and explicit provider copy.', terms: ['carry', 'state', 'encryption', 'passphrase', 'memory', 'assistant'] },
  { id: 'page-performance', title: 'Check a page’s performance', summary: 'A local Web Vitals reading, healthz and public activity counts.', terms: ['performance', 'vitals', 'speed', 'health', 'monitoring', 'analytics'] },
  { id: 'project-inspection', title: 'Check the project you will build', summary: 'Read-only inspection of the selected project, agents, source and package metadata.', terms: ['inspect', 'project', 'audit', 'read-only', 'package', 'agent skills', 'mcp'] },
  { id: 'reference-dependencies', title: 'Prepare the starter’s local tools', summary: 'Opt-in local Astro and Wrangler dependencies for the starter checkout.', terms: ['dependencies', 'install', 'astro', 'wrangler', 'starter', 'mcp'] },
  { id: 'project-preparation', title: 'Give your agent the missing site guidance', summary: 'Add reviewed EmDash site or plugin guidance to an existing project.', terms: ['skills', 'emdash', 'plugin', 'guidance', 'prepare', 'codex'] },
  { id: 'content-project', title: 'Turn a field model into a local EmDash site', summary: 'Generate a local EmDash content site from an exported field model.', terms: ['content', 'site', 'model', 'fields', 'emdash', 'generate', 'template', 'collection'] },
];

export interface DocsGuideLink {
  id: string;
  label: string;
  href: string;
  summary: string;
  terms: string[];
}

export const docsGuideLinks: readonly DocsGuideLink[] = [
  { id: 'prompts', label: 'Prompt library', href: '/prompts', summary: 'Every canonical prompt with fields, editable preview, copy and Markdown download. Public, no login and no model call.', terms: ['prompt', 'prompts', 'copy', 'template', 'handoff', 'agent', 'library'] },
  { id: 'ready', label: 'Get Ready', href: '/ready', summary: 'Check the environment, read a saved report and see the supported setup path.', terms: ['ready', 'setup', 'environment', 'report', 'check', 'install'] },
  { id: 'learn', label: 'First-app tutorial', href: '/learn', summary: 'The newcomer journey from inspection to a first owned change.', terms: ['learn', 'tutorial', 'guide', 'lesson', 'beginner', 'course'] },
  { id: 'setup', label: 'Project setup guide', href: '/setup', summary: 'One portable guide for a new, existing or interrupted project.', terms: ['setup', 'installation', 'portable', 'project', 'guide', 'fresh agent'] },
  { id: 'agent', label: 'Point your agent here', href: '/agent', summary: 'A read-only assessment request for an existing project, with the current support table.', terms: ['agent', 'assessment', 'read-only', 'existing', 'request', 'markdown'] },
  { id: 'roles', label: 'Six agent role packs', href: '/roles', summary: 'Bounded briefs for service ownership, programming, architecture, DevOps, security and QA.', terms: ['roles', 'role pack', 'architect', 'devops', 'security', 'qa', 'programmer'] },
  { id: 'resources', label: 'Runbooks and resources', href: '/resources', summary: 'Change, incident, pipeline and hook runbooks with downloadable Markdown.', terms: ['runbook', 'resources', 'incident', 'pipeline', 'hook', 'change', 'download'] },
  { id: 'init', label: 'Init app builder', href: '/init', summary: 'Describe an app, validate a specification and export the agent handoff.', terms: ['init', 'spec', 'specification', 'build', 'app', 'preset', 'handoff'] },
  { id: 'content-builder', label: 'Content and form builder', href: '/init/content', summary: 'Typed fields, groups and repeaters with a native EmDash seed.', terms: ['content', 'fields', 'form', 'repeater', 'cms', 'model', 'emdash'] },
  { id: 'launch-kit', label: 'Launch Kit', href: '/launch-kit', summary: 'Package share images and captions from a demonstrated feature.', terms: ['share', 'canvas', 'image', 'caption', 'social', 'launch'] },
  { id: 'guide', label: 'Platform and service guide', href: '/guide', summary: 'CMS, cloud, commerce, email, domains and operational ownership.', terms: ['platform', 'cms', 'cloud', 'commerce', 'email', 'ownership', 'wordpress'] },
  { id: 'architecture', label: 'Architecture explainers', href: '/architecture', summary: 'Visual architecture and trust boundaries.', terms: ['architecture', 'diagram', 'system', 'boundaries', 'product shape'] },
  { id: 'connected-apps', label: 'The working composed pair', href: '/demo/connected-apps', summary: 'Use the live Guestbook and Linkarooie pair.', terms: ['demo', 'example', 'connected', 'guestbook', 'linkarooie', 'composition', 'live'] },
  { id: 'release', label: 'Release evidence', href: '/release', summary: 'Verified release identity and its exact remaining boundaries.', terms: ['release', 'evidence', 'verification', 'deploy', 'production', 'status'] },
  { id: 'commerce', label: 'Commerce assessment prompts', href: '/prompts#stripe', summary: 'Stripe, PayPal, Shopify and Printful assessments. Development or sandbox only; no production charge is authorised.', terms: ['stripe', 'paypal', 'shopify', 'printful', 'commerce', 'checkout', 'payments', 'store'] },
  { id: 'how-it-works', label: 'Technical reference', href: '/docs/how-it-works', summary: 'The complete former /docs reference, including MCP, contracts, updates and content projects.', terms: ['reference', 'technical', 'docs', 'mcp', 'contract', 'rollback', 'all'] },
];

export interface DocsUnavailable {
  id: string;
  request: string;
  explanation: string;
  closest: DocsLink;
  terms: string[];
}

/** Requests people reasonably make that are not shipped. Shown honestly. */
export const docsUnavailable: readonly DocsUnavailable[] = [
  {
    id: 'instagram',
    request: 'Connect Instagram or post to social accounts automatically',
    explanation:
      'Composer has no Instagram integration and no automatic social publishing. A share kit prepares images and copy that you post yourself.',
    closest: { label: 'Publish and share', href: '#path-publish' },
    terms: ['instagram', 'connect instagram', 'social', 'post', 'facebook', 'linkedin', 'twitter', 'x', 'tiktok', 'autopost', 'automation'],
  },
  {
    id: 'automatic-updates',
    request: 'Update my app automatically from GitHub',
    explanation:
      'Automatic branch following and webhook-driven updates are not shipped. Updates are explicit, validated and pinned to exact commits.',
    closest: { label: 'Improve, operate or fix', href: '#path-improve' },
    terms: ['automatic', 'auto', 'webhook', 'branch', 'continuous', 'auto update', 'ci', 'sync github'],
  },
  {
    id: 'customer-login',
    request: 'Add customer accounts and login to my site',
    explanation:
      'Public customer accounts are not a shipped Composer feature. EmDash administration is for invited owners; customer authentication would need its own implementation, recovery and acceptance.',
    closest: { label: 'Add something useful', href: '#path-add' },
    terms: ['login', 'log in', 'sign in', 'sign up', 'signup', 'user accounts', 'customers', 'authentication', 'password', 'passkey', 'members'],
  },
  {
    id: 'hosted-chat',
    request: 'Chat with an AI about these docs',
    explanation:
      'There is no hosted model or documentation chatbot, and this search makes no model call. The prompt library copies text for the agent you already use.',
    closest: { label: 'Get a prompt for my agent', href: '/prompts' },
    terms: ['chat', 'chatbot', 'chatgpt', 'ask ai', 'model', 'hosted ai', 'openai', 'copilot', 'ai assistant'],
  },
  {
    id: 'wordpress-import',
    request: 'Import my WordPress site in one click',
    explanation:
      'There is no one-click WordPress migration. The service guide separates the useful content-model lessons from what Astro and EmDash replace, and what still needs review.',
    closest: { label: 'Read the platform and service guide', href: '/guide' },
    terms: ['wordpress', 'import', 'wp', 'one click', 'plugin migration', 'migrate wordpress'],
  },
  {
    id: 'hosted-deploy',
    request: 'Deploy for me from this website',
    explanation:
      'This site cannot install tools, hold your credentials or deploy for you. Your authorised agent does that work in your own environment.',
    closest: { label: 'Start with Get Ready', href: '/ready' },
    terms: ['deploy for me', 'hosted', 'run build', 'execute', 'without agent', 'do it for me', 'no agent'],
  },
];

/** Existing /docs fragment ids. A legacy /docs/how-it-works#id link forwards to the reference. */
export const legacyDocsAnchors: readonly string[] = docsReferenceSections.map(section => section.id);

export interface DocsSearchResult {
  tasks: string[];
  sections: string[];
  guides: string[];
  unavailable: string[];
}

function normalise(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(haystack: string[], query: string): boolean {
  if (!query) return true;
  const text = normalise(haystack.join(' '));
  return query.split(' ').every(term => text.includes(term));
}

/** Local, deterministic search. No model call and no network request. */
export function searchDocs(query: string): DocsSearchResult {
  const q = normalise(query);
  return {
    tasks: docsTaskPaths
      .filter(item => matches([item.question, item.short, item.outcome, item.limit, ...item.prerequisites, ...item.terms], q))
      .map(item => item.id),
    sections: docsReferenceSections
      .filter(item => matches([item.title, item.summary, ...item.terms], q))
      .map(item => item.id),
    guides: docsGuideLinks
      .filter(item => matches([item.label, item.summary, ...item.terms], q))
      .map(item => item.id),
    unavailable: docsUnavailable
      .filter(item => matches([item.request, item.explanation, ...item.terms], q))
      .map(item => item.id),
  };
}

export function docsSearchCount(result: DocsSearchResult): number {
  return result.tasks.length + result.sections.length + result.guides.length + result.unavailable.length;
}
