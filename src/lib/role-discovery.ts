import { apps } from './apps.ts';

export const discoveryRoleIds = ['creator', 'small-business', 'developer', 'designer'] as const;
export type DiscoveryRoleId = typeof discoveryRoleIds[number];
export interface DiscoveryRole {
  id: DiscoveryRoleId;
  label: string;
  title: string;
  headline: string;
  description: string;
  app: typeof apps[number]['id'];
  example: { title: string; description: string; href: string; image: string; alt: string; captured: string; origin: string };
  primary: { label: string; href: string };
  start: { label: string; href: string };
  steps: { title: string; description: string; href: string }[];
  support: string;
  share: string;
}
const app = (id: typeof apps[number]['id']) => apps.find((entry) => entry.id === id)!;
const capture = (id: typeof apps[number]['id']) => {
  const entry = app(id);
  return { image: entry.previewWide, alt: entry.previewAlt, captured: entry.previewCaptured, origin: 'previewOrigin' in entry ? entry.previewOrigin : entry.standalone };
};

export const discoveryRoles: DiscoveryRole[] = [
  {
    id: 'creator', label: 'Creator', title: 'App Composer for creators',
    headline: 'Give your work a place to live.',
    description: 'Bring your music, projects and useful links together. Invite a contribution, review it and choose what your audience sees.',
    app: 'showcase',
    example: { title: 'Loftwah’s Linkarooie', description: 'The owner’s published profile: featured projects, music and grouped links. Try the composition workbench with fictional contributions.', href: '/showcase/', ...capture('showcase') },
    primary: { label: 'Try the composition', href: '/demo' },
    start: { label: 'Make my public page', href: '/init?start=showcase' },
    steps: [
      { title: 'Choose the pieces', description: 'Configure a profile, a visitor book or both in Init.', href: '/init?start=composition' },
      { title: 'Try a contribution', description: 'Use the fictional workbench to see a reviewed photo become a card.', href: '/demo' },
      { title: 'Run your page', description: 'Use the existing owner tools to edit, review and publish.', href: '/manage' },
    ],
    support: 'Public profile and fictional workbench are open to everyone. Editing the owner’s profile requires its existing invitation and permissions. A new creator deployment still needs an authorised agent.',
    share: '/discovery/creator-20261024.png',
  },
  {
    id: 'small-business', label: 'Small business', title: 'App Composer for small business owners',
    headline: 'Publish the page. Keep up with the work.',
    description: 'Start with a useful public page and decide which enquiries belong in your private owner workspace. Keep the content and the follow-up together.',
    app: 'guestbook',
    example: { title: 'A published site you can open', description: 'Fictional Trail Notes is a published stack made in the native editor. The owner walkthrough explains the separately protected enquiry Inbox.', href: '/s/fictional-trail-notes', image: '/guides/app-admin-20261022-trail-desktop.png', alt: 'Actual published Fictional Trail Notes stack with its saved Here / there instances and Open actions.', captured: '2026-10-22', origin: 'https://composer.loftwah.com/s/fictional-trail-notes' },
    primary: { label: 'Open the published example', href: '/s/fictional-trail-notes' },
    start: { label: 'Try a content form', href: '/init/content' },
    steps: [
      { title: 'Describe the page and form', description: 'Try the maintained content models and their generated form.', href: '/init/content' },
      { title: 'See the owner journey', description: 'Review how app-owned briefs reach the protected Inbox.', href: '/manage#journey' },
      { title: 'Prepare your project', description: 'Give your agent one portable setup guide for your existing stack.', href: '/setup#existing' },
    ],
    support: 'The example is fictional. Private enquiries are a bounded no-contact brief workflow; the owner must enable a form for its publication. Email notifications, replies and delivery are not yet supported. This walkthrough does not submit a lead or create a customer account.',
    share: '/discovery/small-business-20261024.png',
  },
  {
    id: 'developer', label: 'Developer / AI builder', title: 'App Composer for developers and AI builders',
    headline: 'Take the next idea all the way to a working app.',
    description: 'Inspect the project, give your agent a complete brief and verify the result. Keep the source, your existing stack and the route back into the work.',
    app: 'hello',
    example: { title: 'Hello World, running independently', description: 'Open the maintained HTTPS starter, inspect its source, then use Get Ready for your own authorised environment.', href: 'https://ready.loftwah.com', ...capture('hello') },
    primary: { label: 'Open the first-app reference', href: 'https://ready.loftwah.com' },
    start: { label: 'Set up my project', href: '/setup#new' },
    steps: [
      { title: 'Inspect and prepare', description: 'New project, existing project or resume: copy one complete guide.', href: '/setup' },
      { title: 'Make the brief concrete', description: 'Preview a supported configuration and export its exact specification.', href: '/init' },
      { title: 'Build, check and keep going', description: 'Use maintained prompts for a change, recovery or publication.', href: '/prompts' },
    ],
    support: 'The Hello recipe targets Codex on an Apple Silicon Mac with Node 22 and existing authorised accounts. Other stacks have an inspect-and-adapt guide. Opening the reference does not prepare your machine or prove a fresh customer deployment.',
    share: '/discovery/developer-20261024.png',
  },
  {
    id: 'designer', label: 'Designer / agency', title: 'App Composer for designers and agencies',
    headline: 'Make the identity work in the finished product.',
    description: 'Compose branded assets, inspect the actual files and hand over a configurable project. Keep the artwork and client choices editable.',
    app: 'launch-kit',
    example: { title: 'Launch Kit, with editable local artwork', description: 'The actual editor prepares icons, PWA assets and social images. Use the fictional sample or artwork you are permitted to use.', href: 'https://composer-launch-kit.loftwah.workers.dev', ...capture('launch-kit') },
    primary: { label: 'Open Launch Kit', href: 'https://composer-launch-kit.loftwah.workers.dev' },
    start: { label: 'Preview a branded composition', href: '/demo' },
    steps: [
      { title: 'Compose the identity', description: 'Choose artwork, text, crop and colour in the working editor.', href: 'https://composer-launch-kit.loftwah.workers.dev' },
      { title: 'Review its adoption', description: 'Inspect the package and preserve the existing Init draft before replacement.', href: '/init/launch-kit' },
      { title: 'Check the result you share', description: 'Inspect served icons, metadata and social artwork with Link Check.', href: 'https://share.loftwah.com' },
    ],
    support: 'Asset composition runs locally in the browser. Package adoption is an explicit reviewed handoff; it does not publish a client site. Client accounts, membership and production release follow their own project permissions.',
    share: '/discovery/designer-20261024.png',
  },
];

export const discoveryJobs = [
  { id: 'profile', label: 'Make my public page', role: 'creator', href: '/for/creator?job=profile' },
  { id: 'enquiries', label: 'Collect private enquiries', role: 'small-business', href: '/for/small-business?job=enquiries' },
  { id: 'first-app', label: 'Build or change an app', role: 'developer', href: '/for/developer?job=first-app' },
  { id: 'branding', label: 'Make branded assets', role: 'designer', href: '/for/designer?job=branding' },
  { id: 'diagram', label: 'Draw an editable diagram', role: null, href: 'https://ldraw.loftwah.com' },
  { id: 'pdf', label: 'Fill or sign a PDF', role: null, href: 'https://paperwork.loftwah.com' },
  { id: 'inspect', label: 'Check a website before sharing', role: null, href: 'https://share.loftwah.com' },
] as const;

export function discoveryRole(id: unknown): DiscoveryRole | undefined {
  return typeof id === 'string' ? discoveryRoles.find((role) => role.id === id) : undefined;
}
