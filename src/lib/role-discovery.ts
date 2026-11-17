import { appDetails, apps } from './apps.ts';
import { composerShareArtwork } from './site-share-artwork.mjs';

export const discoveryRoleIds = ['creator', 'small-business', 'developer', 'designer', 'wordpress', 'shopify', 'platform-team', 'media-producer', 'marketer', 'app-operator'] as const;
export type DiscoveryRoleId = typeof discoveryRoleIds[number];
export interface DiscoveryRole {
  id: DiscoveryRoleId;
  label: string;
  title: string;
  headline: string;
  description: string;
  app: typeof apps[number]['id'];
  example: { title: string; description: string; href: string; image: string; alt: string; captured: string; origin: string; originLabel?: string };
  primary: { label: string; href: string };
  start: { label: string; href: string };
  steps: { title: string; description: string; href: string }[];
  support: string;
  share: string;
  fit?: { keep: string; next: string; evidence: { label: string; href: string } };
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
    headline: 'Publish a page and manage enquiries.',
    description: 'Start with a useful public page and decide which enquiries belong in your private owner workspace. Keep the content and the follow-up together.',
    app: 'guestbook',
    example: { title: 'A published site you can open', description: 'Fictional Trail Notes is a published stack made in the native editor. The owner walkthrough explains the separately protected enquiry Inbox.', href: '/s/fictional-trail-notes', image: '/guides/app-admin-20261022-trail-desktop.png', alt: 'Actual published Fictional Trail Notes stack with its saved Here / there instances and Open actions.', captured: '2026-10-22', origin: 'https://composer.loftwah.com/s/fictional-trail-notes' },
    primary: { label: 'Open the published example', href: '/s/fictional-trail-notes' },
    start: { label: 'Try a content form', href: '/init/content' },
    steps: [
      { title: 'Describe the page and form', description: 'Try the maintained content models and their generated form.', href: '/init/content' },
      { title: 'See the owner journey', description: 'Review how app-owned briefs reach the protected Inbox.', href: '/manage#journey' },
      { title: 'Prepare your project', description: 'Give your agent one portable setup guide for your existing stack.', href: '/setup?mode=existing' },
    ],
    support: 'The example is fictional. Private enquiries are a bounded no-contact brief workflow; the owner must enable a form for its publication. Email notifications, replies and delivery are not yet supported. This walkthrough does not submit a lead or create a customer account.',
    share: '/discovery/small-business-20261024.png',
  },
  {
    id: 'developer', label: 'Developer / AI builder', title: 'App Composer for developers and AI builders',
    headline: 'Take your idea to a working app.',
    description: 'Inspect the project, give your agent a complete brief and verify the result. Keep the source, your existing stack and the route back into the work.',
    app: 'hello',
    example: { title: 'Hello World, running independently', description: 'Open the maintained HTTPS starter, inspect its source, then use Get Ready for your own authorised environment.', href: 'https://ready.loftwah.com', ...capture('hello') },
    primary: { label: 'Open the first-app reference', href: 'https://ready.loftwah.com' },
    start: { label: 'Set up my project', href: '/setup?mode=new' },
    steps: [
      { title: 'Inspect and prepare', description: 'New project, existing project or resume: copy one complete guide.', href: '/setup' },
      { title: 'Make the brief concrete', description: 'Preview a supported configuration and export its exact specification.', href: '/init' },
      { title: 'Build, check and keep going', description: 'Use maintained prompts for a change, recovery or publication.', href: '/prompts' },
    ],
    support: 'The Hello recipe targets Codex on an Apple Silicon Mac with Node 22, 24 or 26 and existing authorised accounts. Other stacks have an inspect-and-adapt guide. Opening the reference does not prepare your machine or prove a fresh customer deployment.',
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

  {
    id: 'wordpress', label: 'WordPress / agency', title: 'App Composer for WordPress and agency work',
    headline: 'Prove one content move before a rebuild.',
    description: 'Try a portable content model and an owner-editable page. Check the content, media and ordinary editing your client actually needs before choosing a destination.',
    app: 'guestbook',
    example: { title: 'An imported publisher, still editable', description: 'The fictional Weekender was imported into native EmDash, reconciled, edited twice and checked with its WordPress source stopped. Inspect its exact results and remaining gates.', href: '/migration-example', image: '/evidence/weekender-reader-20261025.png', alt: 'Actual isolated Macedon Weekender article with an app-owned image, imported text and owner edits.', captured: '2026-10-25', origin: 'https://github.com/loftwah/app-composer/tree/main/labs/wordpress/weekender', originLabel: 'Isolated local WordPress → EmDash lab' },
    primary: { label: 'Inspect the publisher migration', href: '/migration-example' },
    start: { label: 'Try a content model', href: '/init/content' },
    steps: [
      { title: 'List the behaviour to preserve', description: 'Record URLs, content types, media, forms, editor tasks and the plugins that supply them. Keep the current site as the reference.', href: '/guide#platforms' },
      { title: 'Try one representative model', description: 'Use a maintained model and its real form before authorising an isolated import of public or fictional content.', href: '/init/content' },
      { title: 'Review exact plugin evidence', description: 'Inspect the curated release, permissions and unknowns. Plugin installation needs a separately qualified native target.', href: '/plugin-trust' },
    ],
    support: 'The migration lab has a small documented WordPress import; it does not establish Elementor, ACF, WooCommerce or whole-site parity. Keep WordPress when a required plugin, workflow or recovery path has no verified replacement.',
    fit: { keep: 'Keep the existing site, URLs and client choices until representative editing, media and recovery checks pass.', next: 'Write one acceptance brief for a content type and its existing editor task.', evidence: { label: 'Read the migration observations', href: 'https://github.com/loftwah/app-composer/blob/main/labs/wordpress/weekender/OBSERVATIONS.md' } },
    share: composerShareArtwork.path,
  },
  {
    id: 'shopify', label: 'Shopify developer', title: 'App Composer beside a Shopify store',
    headline: 'Build the work beside your store.',
    description: 'Give operators a small content, community or review application with its own source and admin. Keep commerce on the store’s established path.',
    app: 'showcase',
    example: { title: 'An independently operated content page', description: 'Linkarooie shows the content/community side: owned links, reviewed source contributions and current publication state. It has no Shopify connection.', href: '/showcase/', ...capture('showcase') },
    primary: { label: 'Open the content example', href: '/showcase/' },
    start: { label: 'Assess my existing project', href: '/agent' },
    steps: [
      { title: 'Name the operator job', description: 'Describe a useful application that still makes sense without Shopify: editorial content, community curation or a reviewed internal request.', href: '/setup?mode=existing' },
      { title: 'Keep one checkout owner', description: 'Decide which platform owns checkout, payment and order state before proposing a connection.', href: '/guide#commerce' },
      { title: 'Try a source-owned content model', description: 'Prove the independent application with fictional data before requesting any commerce account or scope.', href: '/init/content' },
    ],
    support: 'Composer has no Shopify adapter, OAuth grant, webhook integration or verified store lifecycle. Native Shopify tooling remains the path for themes, checkout and embedded extensions; the fictional Orders view is not a merchant integration.',
    fit: { keep: 'Keep Shopify’s checkout, storefront tooling and merchant workflows. Composer is a possible companion for a separate job.', next: 'Ask the agent whether the proposed companion remains useful without a store connection.', evidence: { label: 'Read the dated fit assessment', href: 'https://github.com/loftwah/app-composer/blob/main/docs/research/2026-10-25/357-shopify-fit.md' } },
    share: composerShareArtwork.path,
  },
  {
    id: 'platform-team', label: 'Cloudflare team', title: 'App Composer for small Cloudflare teams',
    headline: 'Take one internal request through review.',
    description: 'Make a bounded app request, review the proposed change and keep the source and release evidence with the work. Start with one team and one useful application.',
    app: 'hello',
    example: { title: 'A recorded two-team journey', description: 'Fictional teams request an application, review a contribution and update it in the working platform walkthrough.', href: '/platform/demo', image: '/demos/platform-native-25dc7589-b3cd5894/overview-poster.jpg', alt: 'Recorded fictional team request in the App Composer internal platform walkthrough.', captured: '2026-10-23', origin: 'https://composer.loftwah.com/platform/demo' },
    primary: { label: 'Watch the team journey', href: '/platform/demo' },
    start: { label: 'Define the request', href: '/setup?mode=existing' },
    steps: [
      { title: 'Try the request and review', description: 'Inspect the fictional journey, including which decisions stay with the team owner.', href: '/platform/demo' },
      { title: 'Keep environment boundaries visible', description: 'Review Production and Preview isolation and the exact current release path.', href: '/architecture#dashboard' },
      { title: 'Give the agent a bounded role', description: 'Choose the service-owner or DevOps pack for the actual work, with current evidence and explicit stop conditions.', href: '/roles' },
    ],
    support: 'Composer demonstrates a small Cloudflare studio. Enterprise identity lifecycle, real mandatory-MFA enforcement, customer recovery and data-residency requirements need their own acceptance. It is not a replacement for an established enterprise platform.',
    fit: { keep: 'Keep existing deployment tools, identity controls and operational ownership that already work.', next: 'Choose one reversible internal application change and write its expected result and recovery check.', evidence: { label: 'Read the dated team-fit assessment', href: 'https://github.com/loftwah/app-composer/blob/main/docs/research/2026-10-25/359-platform-buyers.md' } },
    share: composerShareArtwork.path,
  },
  {
    id: 'media-producer', label: 'Media producer', title: 'App Composer for media producers',
    headline: 'Make the cut, then keep the source.',
    description: 'Start from an owned song or saved footage, direct one scene at a time, review the cut and choose what to publish. Free local editing stays separate from paid provider work.',
    app: 'media-studio',
    example: { title: 'Paper & Light — studio cut', description: 'A real published Studio film assembled from saved takes with a Studio Score bed. Watch the cut, then read how the project stays owned.', href: 'https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9', image: '/media-studio/studio-public-20261114.jpg', alt: 'Actual published Paper and Light film page in Media Studio with its assembled cut, source note and playback controls.', captured: '2026-11-14', origin: 'https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9' },
    primary: { label: 'Watch the published cut', href: 'https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9' },
    start: { label: 'Browse Share artwork', href: '/share' },
    steps: [
      { title: 'Start free in the browser', description: 'Trim a song locally without a model call or account.', href: 'https://media.loftwah.com/tools/audio-trim' },
      { title: 'Read the current Studio boundary', description: 'See what is free, what costs provider money and what remains a local render.', href: '/media-studio' },
      { title: 'Inspect published work', description: 'Open Share artwork and check the source notes on each piece.', href: '/share' },
    ],
    support: 'The published film and free local tools are open. Paid image, video or music generation needs the studio owner’s existing grant, shows an estimate and may be unavailable when provider funding or a model is unavailable. A saved storyboard is not a finished render.',
    share: '/media-studio/share-kit/media-studio-og-1200x630.jpg',
  },
  {
    id: 'marketer', label: 'Marketer', title: 'App Composer for marketers',
    headline: 'Turn an approved asset into a shareable draft.',
    description: 'Start from a real published creative asset, prepare the right image sizes and inspect the destination before a manual handoff. No social account is connected otherwise.',
    app: 'showcase',
    example: { title: 'Media Studio share kit', description: 'A real 1200×630 social card prepared from the Studio identity, with the published work it points to.', href: '/share', image: '/media-studio/share-kit/media-studio-og-1200x630-20261114.png', alt: 'Actual Media Studio social share card with the studio artwork, title and App Composer identity.', captured: '2026-11-14', origin: 'https://media.loftwah.com/portfolio' },
    primary: { label: 'Browse Share artwork', href: '/share' },
    start: { label: 'Prepare a share image', href: '/launch-kit' },
    steps: [
      { title: 'Prepare the asset', description: 'Compose icons or a social card locally from artwork you may use.', href: '/launch-kit' },
      { title: 'Inspect before sharing', description: 'Check metadata, headings and the social image on the destination.', href: 'https://share.loftwah.com' },
      { title: 'Use the existing Share record', description: 'See how an approved creative asset becomes a shareable, attributable page.', href: '/creator-hub' },
    ],
    support: 'Composer does not connect a social account, schedule posts or report reach. Preparation and inspection are real; publishing to a social platform remains a manual owner step. The portfolio and share examples are public.',
    share: '/media-studio/share-kit/media-studio-og-1200x630-20261114.png',
  },
  {
    id: 'app-operator', label: 'App operator', title: 'App Composer for app operators',
    headline: 'Run the app after launch.',
    description: 'Check public activity, review owner-only work and keep the release evidence with the app. Start from an existing invitation and the current owner workspace.',
    app: 'guestbook',
    example: { title: 'Fictional Trail Notes in the owner workspace', description: 'The actual published stack with its saved app instances and owner actions. The private enquiry Inbox behind it is separately protected.', href: '/manage#journey', image: '/guides/app-admin-20261022-trail-desktop.png', alt: 'Actual owner workspace for Fictional Trail Notes with its saved app instances and Open actions.', captured: '2026-10-22', origin: 'https://composer.loftwah.com/manage' },
    primary: { label: 'Open the owner journey', href: '/manage#journey' },
    start: { label: 'Check public activity', href: '/activity' },
    steps: [
      { title: 'Read current public activity', description: 'Use the real app record and daily evidence; a missing record stays unknown.', href: '/activity' },
      { title: 'Review owner-only work', description: 'Open the protected workspace with the existing invitation and permissions.', href: '/manage' },
      { title: 'Check the released source', description: 'Read the current release identity and evidence index before changing anything.', href: '/release' },
    ],
    support: 'The owner workspace needs its existing invitation and access session; this page grants nothing. Public analytics are aggregate and may be incomplete. No static example can guarantee incident remediation or a customer deployment.',
    share: composerShareArtwork.path,
  },

];

export const discoveryJobIds = ['profile', 'enquiries', 'first-app', 'branding', 'diagram', 'pdf', 'inspect', 'produce', 'publish', 'operate'] as const;
export type DiscoveryJobId = typeof discoveryJobIds[number];
export interface DiscoveryJob {
  id: DiscoveryJobId;
  label: string;
  title: string;
  headline: string;
  outcome: string;
  description: string;
  app: typeof apps[number]['id'];
  example: DiscoveryRole['example'];
  action: { label: string; href: string };
  relatedRoles: DiscoveryRoleId[];
  roleNote: string;
  support: string;
  share: string;
  shareAlt: string;
}
const roleFor = (id: DiscoveryRoleId) => discoveryRoles.find((role) => role.id === id)!;
const shareType = (href: string) => href.endsWith('.jpg') ? 'image/jpeg' : 'image/png';

export const discoveryJobs: DiscoveryJob[] = [
  {
    id: 'profile', label: 'Make my public page',
    title: 'Make a public page for your work',
    headline: 'Put your work on one page people can use.',
    outcome: 'Bring your projects, music and useful links together on a page you can update. Choose what your audience sees and keep the source with the result.',
    description: 'Build a public profile page with your projects, music and links, then choose what your audience sees. Start with the existing Linkarooie configuration.',
    app: 'showcase',
    example: roleFor('creator').example,
    action: roleFor('creator').start,
    relatedRoles: ['creator'],
    roleNote: 'Usually the creator route.',
    support: roleFor('creator').support,
    share: roleFor('creator').share,
    shareAlt: 'App Composer discovery card for creators, using the actual Linkarooie profile capture.',
  },
  {
    id: 'enquiries', label: 'Collect private enquiries',
    title: 'Collect private enquiries from your website',
    headline: 'Collect enquiries privately.',
    outcome: 'Put a short form on a public page, then review what visitors send in a private owner workspace. Keep the public page and the follow-up separate.',
    description: 'Add a private enquiry form to a published page, review briefs in an owner-only workspace and keep visitor contact details out of public view.',
    app: 'guestbook',
    example: roleFor('small-business').example,
    action: roleFor('small-business').start,
    relatedRoles: ['small-business'],
    roleNote: 'Usually the small business route.',
    support: roleFor('small-business').support,
    share: roleFor('small-business').share,
    shareAlt: 'App Composer discovery card for small business, using the actual Fictional Trail Notes capture.',
  },
  {
    id: 'first-app', label: 'Build or change an app',
    title: 'Build or change an app with an agent',
    headline: 'Take an idea to a working app.',
    outcome: 'Describe the app, give your agent a complete brief and check the result at a real HTTPS address. Keep the source and the route back into the work.',
    description: 'Turn an idea into a working app: choose the project, export a complete brief and verify the deployed result, with the Hello World reference.',
    app: 'hello',
    example: roleFor('developer').example,
    action: roleFor('developer').start,
    relatedRoles: ['developer'],
    roleNote: 'Usually the developer / AI builder route.',
    support: roleFor('developer').support,
    share: roleFor('developer').share,
    shareAlt: 'App Composer discovery card for developers, using the actual Hello World capture.',
  },
  {
    id: 'branding', label: 'Make branded assets',
    title: 'Make branded app icons and share images',
    headline: 'Make the icons and images your product needs.',
    outcome: 'Turn artwork you are allowed to use into app icons, PWA assets and social cards. Inspect the actual files before you hand them over.',
    description: 'Compose app icons, PWA assets and social cards locally, inspect every exported file and prepare a reviewed handoff with Launch Kit.',
    app: 'launch-kit',
    example: roleFor('designer').example,
    action: roleFor('designer').primary,
    relatedRoles: ['designer'],
    roleNote: 'Usually the designer / agency route.',
    support: roleFor('designer').support,
    share: roleFor('designer').share,
    shareAlt: 'App Composer discovery card for designers, using the actual Launch Kit capture.',
  },
  {
    id: 'diagram', label: 'Draw an editable diagram',
    title: 'Draw an editable diagram',
    headline: 'Draw an editable diagram.',
    outcome: 'Sketch the system, workflow or idea in a real editor. Keep an editable file for the next change, then export SVG or PNG for the page.',
    description: 'Draw and save editable diagrams in the browser, start from a named block library and export PNG or SVG with the working LDraw editor.',
    app: 'ldraw',
    example: {
      title: 'LDraw, the working editor',
      description: 'The actual dark workspace with its named block library and the Creator journey example. Open it, draw and save an editable file.',
      href: 'https://ldraw.loftwah.com/',
      ...capture('ldraw'),
    },
    action: { label: 'Open LDraw', href: 'https://ldraw.loftwah.com/' },
    relatedRoles: ['designer', 'developer'],
    roleNote: 'Useful for designer and developer work.',
    support: 'Save an editable .excalidraw file before clearing browser data. ' + appDetails.ldraw.connection,
    share: app('ldraw').share,
    shareAlt: app('ldraw').shareAlt,
  },
  {
    id: 'pdf', label: 'Fill or sign a PDF',
    title: 'Fill and sign a PDF without printing it',
    headline: 'Fill, sign and save a PDF in the browser.',
    outcome: 'Open an ordinary form, fill its fields, draw or sign and download the completed document. The file stays in your browser.',
    description: 'Fill native PDF fields, draw, add a signature and save or print the completed document. Paperwork keeps document files in the browser.',
    app: 'paperwork',
    example: {
      title: 'Paperwork, completing a real form',
      description: 'The deployed editor with the fictional acceptance form, added text, ink, highlight and a transparent demo signature.',
      href: '/paperwork',
      image: '/paperwork/editor-20261024-compact.webp',
      alt: 'Actual deployed Paperwork PDF editor with native fields and added text, ink, highlight and transparent fictional signature.',
      captured: '2026-10-24',
      origin: 'https://paperwork.loftwah.com',
    },
    action: { label: 'Try the fictional sample', href: 'https://paperwork.loftwah.com/?sample=garden' },
    relatedRoles: ['small-business', 'designer'],
    roleNote: 'Useful for small business and client paperwork.',
    support: 'Documents and signatures stay in the browser, with no account, upload, document analytics or cloud storage. Ordinary PDFs up to 30 MB and 100 pages. Password-protected, XFA and already certificate-signed documents are refused. ' + appDetails.paperwork.connection,
    share: app('paperwork').share,
    shareAlt: app('paperwork').shareAlt,
  },
  {
    id: 'inspect', label: 'Check a website before sharing',
    title: 'Check a website before you share it',
    headline: 'Inspect a link before sharing it.',
    outcome: 'Inspect a public page’s icons, share image, metadata and headings. Get a list of findings you can act on before the link goes out.',
    description: 'Inspect favicons, social images, metadata, headings and image descriptions on a public page, then export the findings with Link Check.',
    app: 'linkcheck',
    example: {
      title: 'Link Check, with a real inspection',
      description: 'The actual deployed inspection form, its supported discovery checks and the explanation of what it inspects.',
      href: 'https://share.loftwah.com',
      ...capture('linkcheck'),
    },
    action: { label: 'Open Link Check', href: 'https://share.loftwah.com' },
    relatedRoles: ['developer', 'designer'],
    roleNote: 'Useful before a developer or designer release.',
    support: 'Link Check inspects one public HTTPS page and optional robots.txt or one sitemap; it does not crawl the site. Local and private addresses and credential-bearing URLs are blocked. ' + appDetails.linkcheck.connection,
    share: app('linkcheck').share,
    shareAlt: app('linkcheck').shareAlt,
  },
  {
    id: 'produce', label: 'Make a film',
    title: 'Make and publish a short film',
    headline: 'Turn an owned song or footage into a reviewed cut.',
    outcome: 'Choose an owned source, direct saved scenes, assemble a cut and decide what to publish. Keep the original media and every earlier render.',
    description: 'Use Media Studio’s saved storyboard, local render and publish flow from a real published example.',
    app: 'media-studio',
    example: roleFor('media-producer').example,
    action: roleFor('media-producer').start,
    relatedRoles: ['media-producer'],
    roleNote: 'Usually the media producer route.',
    support: roleFor('media-producer').support,
    share: roleFor('media-producer').share,
    shareAlt: 'Media Studio share card for the published Paper and Light film.',
  },
  {
    id: 'publish', label: 'Prepare a share kit',
    title: 'Prepare a share kit for an approved asset',
    headline: 'Make the sizes, inspect the result, then share deliberately.',
    outcome: 'Turn an approved image or identity into the sizes a destination needs, inspect the page it points to and keep a manual, attributable handoff.',
    description: 'Prepare a social card or icon set locally, check the destination and avoid implying an account connection that does not exist.',
    app: 'launch-kit',
    example: roleFor('marketer').example,
    action: roleFor('marketer').start,
    relatedRoles: ['marketer'],
    roleNote: 'Usually the marketer route.',
    support: roleFor('marketer').support,
    share: roleFor('marketer').share,
    shareAlt: 'Media Studio social share card used in the marketer journey.',
  },
  {
    id: 'operate', label: 'Operate a live app',
    title: 'Operate a live app after launch',
    headline: 'Read activity, review owner work and check the release.',
    outcome: 'Use the real app record, open the protected owner workspace only with existing permission and inspect the released source before changing anything.',
    description: 'Follow one operator loop through public activity, owner-only review and current release evidence.',
    app: 'guestbook',
    example: roleFor('app-operator').example,
    action: roleFor('app-operator').start,
    relatedRoles: ['app-operator'],
    roleNote: 'Usually the app operator route.',
    support: roleFor('app-operator').support,
    share: roleFor('app-operator').share,
    shareAlt: 'App Composer owner workspace capture used in the app operator journey.',
  },
];

export const discoveryHubDescription = `Choose by role (${discoveryRoles.map((role) => role.label).join(', ')}) or by job (${discoveryJobs.map((job) => job.label).join(', ')}). Open a working example, then start with the existing tool.`;

export function discoveryRole(id: unknown): DiscoveryRole | undefined {
  return typeof id === 'string' ? discoveryRoles.find((role) => role.id === id) : undefined;
}

export function discoveryJob(id: unknown): DiscoveryJob | undefined {
  return typeof id === 'string' ? discoveryJobs.find((job) => job.id === id) : undefined;
}

export function discoveryJobPath(id: DiscoveryJobId) {
  return '/jobs/' + id;
}

export function discoveryJobForRole(roleId: unknown, jobId: unknown): DiscoveryJob | undefined {
  const role = discoveryRole(roleId);
  const job = discoveryJob(jobId);
  return role && job && job.relatedRoles.includes(role.id) ? job : undefined;
}

export function discoveryShareType(share: string) {
  return shareType(share);
}
