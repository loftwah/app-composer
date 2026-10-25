export interface AtlasDiagram {
  name: string;
  title: string;
  alt: string;
  caption: string;
  usedOn: { label: string; href: string }[];
  steps: { title: string; detail: string }[];
}

export const diagramAtlas: readonly AtlasDiagram[] = [
  {
    name: 'get-ready-lifecycle',
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
    title: 'Local agent → scoped proposal → human review → execution',
    alt: 'A local agent inspects an authorised workspace and returns a reviewable proposal. A signed-in human accepts, sends back with notes or rejects it. Execution happens only through the existing release path on the other side of a dashed human-authority boundary. The agent grant cannot approve, deploy, merge, spend, read secrets or change access.',
    caption: 'The proposal is the handoff. The approval and the execution remain separate, signed actions.',
    usedOn: [{ label: 'Agent entry', href: '/agent' }, { label: 'Architecture', href: '/architecture#ownership' }],
    steps: [
      { title: 'Local agent', detail: 'Uses the owner’s machine, model and selected workspace under a read-only scope.' },
      { title: 'Scoped proposal', detail: 'Records source identity, cited evidence, risk, unknowns and one bounded change.' },
      { title: 'Human review', detail: 'Accept, send back with notes, or reject. Returning work preserves prior findings, links and versions.' },
      { title: 'Execution boundary', detail: 'The existing release path, exact source and environment, reversible checks and independent verification. No self-approval, stale approval or duplicate execution.' },
    ],
  },
  {
    name: 'cloudflare-isolation',
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
];

export function diagramByName(name: string): AtlasDiagram {
  const diagram = diagramAtlas.find((entry) => entry.name === name);
  if (!diagram) throw new Error(`Unknown diagram: ${name}`);
  return diagram;
}
