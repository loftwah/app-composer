export interface AtlasDiagram {
  name: string;
  assetName?: string;
  assetDirectory?: string;
  imageWidth?: number;
  imageHeight?: number;
  title: string;
  alt: string;
  caption: string;
  usedOn: { label: string; href: string }[];
  steps: { title: string; detail: string }[];
}

export const engineeringDiagrams: readonly AtlasDiagram[] = [
  {
    name: 'composer-purpose',
    assetDirectory: '/diagrams/engineering',
    imageWidth: 2408, imageHeight: 1191,
    title: 'What App Composer is for',
    alt: 'A diagram connects the creator’s idea and decisions to an agent, reusable building blocks and release evidence, then to an owned product. A separate row records product direction.',
    caption: 'The creator decides what to make. App Composer brings together the agent, building blocks, creative tools and release checks needed to make it real.',
    usedOn: [{ label: 'Share artwork', href: '/share#diagram-artwork' }],
    steps: [
      { title: 'Creator direction', detail: 'The creator sets the goal and makes the meaningful decisions.' },
      { title: 'Build and verify', detail: 'The chosen agent can work with reusable capabilities, creative tools and visible checks.' },
      { title: 'Owned result', detail: 'The project keeps its own source, data and release path. The final row shows the broader product direction.' },
    ],
  },
  {
    name: 'composer-agent-and-owner',
    assetDirectory: '/diagrams/engineering',
    imageWidth: 1932, imageHeight: 1191,
    title: 'Agent and owner authority',
    alt: 'A diagram of the agent’s bounded proposal, owner review and separate execution with evidence.',
    caption: 'The person keeps approval authority. The agent works within the permissions granted for the job.',
    usedOn: [{ label: 'Share artwork', href: '/share#diagram-artwork' }],
    steps: [
      { title: 'Proposal', detail: 'The agent proposes a scoped change and records evidence.' },
      { title: 'Decision', detail: 'An owner reviews the proposal before execution.' },
      { title: 'Execution', detail: 'The approved operation remains a distinct step with its own checks.' },
    ],
  },
  {
    name: 'composer-creative-pipeline',
    assetDirectory: '/diagrams/engineering',
    imageWidth: 2408, imageHeight: 1191,
    title: 'Creative production and reuse',
    alt: 'A diagram of references, working media, review and the approved public artwork made from them.',
    caption: 'The creative source and its variants remain available when a finished piece is published.',
    usedOn: [{ label: 'Share artwork', href: '/share#diagram-artwork' }],
    steps: [
      { title: 'Gather references', detail: 'Start from selected references and project-owned media.' },
      { title: 'Make and revise', detail: 'Keep editable work, variants and provenance with the project.' },
      { title: 'Share', detail: 'Publish a selected, eligible rendition and leave a path to the source.' },
    ],
  },
];

export const diagramAtlas: readonly AtlasDiagram[] = [
  {
    name: 'get-ready-lifecycle',
    imageWidth: 2176, imageHeight: 1355,
    title: 'Get Ready → Init → EmDash → application lifecycle',
    alt: 'Four App Composer stages: Get Ready prepares local tools, source and Cloudflare access; Init produces a validated brief, content model and source pins; EmDash supplies native admin, collections, typed fields and plugin contracts; the application lifecycle covers deploy, observe, update and recover. Owner decisions and evidence stay separate.',
    caption: 'Each stage produces something the next can inspect. Owner authority and release evidence do not move into the happy path.',
    usedOn: [{ label: 'Get Ready', href: '/ready' }],
    steps: [
      { title: 'Get Ready', detail: 'Checks local tools, GitHub source, Cloudflare access and the exact HTTPS result. A local or provider pass stays scoped to that environment.' },
      { title: 'Init', detail: 'Turns the owner’s brief into a validated specification, content model, app settings and exact source pins.' },
      { title: 'EmDash', detail: 'Provides the native admin, collections, typed fields and plugin contracts used to run editable content.' },
      { title: 'Application lifecycle', detail: 'Covers deploy, observe, update and recover. A local pass is not a deployed release; provider, device and owner acceptance stay separate.' },
    ],
  },
  {
    name: 'agent-approval-boundary',
    assetName: 'agent-approval-recovery-20261025',
    imageWidth: 2016, imageHeight: 987,
    title: 'Local agent → owner review → verified local recovery',
    alt: 'A local agent investigates a fictional application and submits a proposal. A signed-in human owner accepts, sends back with notes or rejects it. Separate explicit execution checks the accepted digest, source, grant, app scope and current revision before one fixed local caption repair. Three independent HTTP response hashes confirm recovery. Production actions remain separately gated. The agent grant cannot approve, deploy, merge, spend, read secrets or change access.',
    caption: 'Revised through the local LDraw MCP to explain the qualified local caption repair. Approval, execution and recovery verification remain separate actions.',
    usedOn: [{ label: 'Agent entry', href: '/agent' }, { label: 'Architecture', href: '/architecture#ownership' }],
    steps: [
      { title: 'Local agent', detail: 'Investigates the selected workspace under its scoped grant and cites the observed failure, control and uncertainty.' },
      { title: 'Scoped proposal', detail: 'Records source identity, cited evidence, risk, unknowns and one bounded change.' },
      { title: 'Human review', detail: 'Accept, send back with notes, or reject. Returning work preserves prior findings, links and versions.' },
      { title: 'Execution and verification', detail: 'Approval does not execute. An explicit owner-local command rechecks the exact accepted candidate, source, grant and current state before one fixed caption repair. Three independent HTTP samples and the unaffected team must match. Production operations require their own qualified adapter and authority.' },
    ],
  },
  {
    name: 'cloudflare-isolation',
    imageWidth: 2335, imageHeight: 1355,
    title: 'Production, Preview and resource isolation',
    alt: 'Production has a Worker with exact pushed-main source and release identity, plus production D1, R2 and KV. Preview has a separate Worker selected at build time, distinct preview D1, R2 and KV, and no audience. Production service bindings are absent in Preview. A dashed boundary separates resources and secrets.',
    caption: 'A missing Preview binding fails closed. It does not fall back to production.',
    usedOn: [{ label: 'Architecture', href: '/architecture#dashboard' }],
    steps: [
      { title: 'Production', detail: 'Public routes plus an Access-protected admin. The exact pushed-main source and Worker release identity are recorded.' },
      { title: 'Preview', detail: 'Selects CLOUDFLARE_ENV at build time, uses distinct preview resources and remains closed without an audience.' },
      { title: 'Separate resources and secrets', detail: 'Preview D1, R2 and KV do not inherit production. Production service bindings are absent rather than substituted.' },
      { title: 'Fail closed', detail: 'When a Preview binding, secret or environment value is missing, the correct result is an explicit failure, not a production fallback.' },
    ],
  },
  {
    name: 'contribution-boundary',
    assetName: 'contribution-boundary-20261025-model',
    imageWidth: 1936, imageHeight: 872,
    title: 'A pending postcard, an approval and a separate featuring choice',
    alt: 'Here / there receives a pending postcard. An owner approves it; Linkarooie features it only after an explicit selection. Hiding the source item removes its dependent public card and media. Approval and featuring remain separate actions.',
    caption: 'A model-driven revision of the maintained journey preset. Composer orange and the documented Linkarooie lime family retain their distinct roles; this explains the implemented publication boundary.',
    usedOn: [{ label: 'Build story', href: '/building#composition' }],
    steps: [
      { title: 'Pending', detail: 'The submission is private until the source owner approves it.' },
      { title: 'Approved', detail: 'Approval makes the source item eligible; it does not feature it in Linkarooie.' },
      { title: 'Featured', detail: 'The owner selects the approved source item explicitly in Linkarooie.' },
      { title: 'Hidden at source', detail: 'Current source visibility removes the dependent public card and media.' },
    ],
  },
];

export function diagramByName(name: string): AtlasDiagram {
  const diagram = diagramAtlas.find((entry) => entry.name === name);
  if (!diagram) throw new Error(`Unknown diagram: ${name}`);
  return diagram;
}
