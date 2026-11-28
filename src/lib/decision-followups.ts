import type { Decision } from "./portfolio-decision-contract.ts";

type FollowUp = {
  id: string;
  previous: string;
  project: string;
  category: NonNullable<Decision["category"]>;
  tags: string[];
  question: string;
  context: string;
  choices: string[];
  source: [string, string];
  visualComparison?: boolean;
};

const briefs: FollowUp[] = [
  {
    id: "composer-homepage-promise",
    previous: "composer-live-example",
    project: "App Composer",
    category: "Product direction",
    tags: ["homepage", "call to action"],
    question:
      "What should a first-time visitor be able to do from the Composer homepage?",
    context:
      "Open the current homepage and try its main action. Which promise would make someone new want to click, and what should they have in hand after that click? The answer will guide the next opening and its primary action.",
    choices: [
      "Describe a problem and see how Composer would help build a working app",
      "Open a real app and see how to build a version I can own",
      "Watch a creator finish something and try the same workflow",
      "Take a useful starting point and make it mine",
    ],
    source: ["Open the Composer homepage", "https://composer.loftwah.com/"],
  },
  {
    id: "composer-campaign-audience",
    previous: "campaign-jobs",
    project: "App Composer",
    category: "Creative review",
    tags: ["campaigns", "brand voice"],
    question:
      "Who should a Composer campaign speak to, and what should it help them do?",
    context:
      "We can make separate campaigns for distinct audiences. Pick every audience and job worth developing into its own brief. Add an example of a voice or visual you would recognise as Composer.",
    choices: [
      "Beginners who want to build a useful app they can own",
      "Creators who need an editable starting point for a piece of work",
      "Developers who want to inspect and reuse a working example",
      "Small teams that need a tool for a recurring job",
    ],
    source: [
      "Read the Composer field report",
      "https://composer.loftwah.com/articles/asking-the-ai-twice",
    ],
  },
  {
    id: "share-wall-discovery",
    previous: "share-first-find",
    project: "Share",
    category: "Discovery",
    tags: ["artwork wall", "relevance", "tags"],
    question: "What should Share use to show more artwork worth opening?",
    context:
      "Open a piece that catches your eye in the Share wall. Think about what you would want to see immediately after it. A specific pair of pieces or a screenshot will help us test what belongs together.",
    choices: [
      "A similar visual style, colour or subject",
      "More from the same project or collection",
      "Pieces I could use for the same task",
      "More of the categories and tags I choose to follow",
    ],
    source: [
      "Open the Share artwork wall",
      "https://composer.loftwah.com/share/artwork",
    ],
  },
  {
    id: "studio-commission-purpose",
    previous: "studio-case-study",
    project: "Media Studio",
    category: "Creative review",
    tags: ["film", "commission", "audience"],
    question:
      "What job would make a new Media Studio film worth commissioning?",
    context:
      "Start with an audience and an outcome for the film. Tell us who would watch it, where it would appear, and what they should know, feel or do afterwards. This brief can lead to a new piece.",
    choices: [
      "Show someone how to complete one real creative workflow",
      "Tell the story behind a release people can actually use or hear",
      "Give someone a reason to try a specific product",
    ],
    source: [
      "See the current Media Studio films",
      "https://composer.loftwah.com/media-studio/films",
    ],
  },
  {
    id: "loftwahfm-release-discovery",
    previous: "radio-release-proof",
    project: "LoftwahFM",
    category: "Discovery",
    tags: ["music", "releases", "tags"],
    question:
      "How would you want to find the right LoftwahFM release to share?",
    context:
      "Think of the last time you wanted to send someone a track, album or video. What did you remember about it? The answer will guide how releases are labelled and found.",
    choices: [
      "The artist, collaborator, album or series I remembered",
      "The mood, genre or occasion it suited",
      "Whether it was a track, album or video",
      "When it came out or where I heard it",
    ],
    source: ["Open LoftwahFM", "https://fm.loftwah.com/"],
  },
  {
    id: "composer-newcomer-proof",
    previous: "project-proof-next",
    project: "App Composer",
    category: "Workflow",
    tags: ["newcomer", "first app", "release proof"],
    question:
      "What should we observe before calling Composer’s first-app journey ready?",
    context:
      "Use one newcomer and one build in the real Composer journey. Pick the evidence that would convince you they could take the app from an idea to something they can keep using.",
    choices: [
      "They can start from a useful example and make it their own",
      "They can deploy the app on their own account and open its URL",
      "They can return later, make a change and verify it live",
    ],
    source: ["Walk through Get Ready", "https://composer.loftwah.com/ready"],
  },
  {
    id: "composer-feedback-entry",
    previous: "owner-feedback-next",
    project: "App Composer",
    category: "Working preferences",
    tags: ["feedback", "sign-in", "review"],
    question: "Where would you naturally leave feedback while using Composer?",
    context:
      "Think of the moment you notice something worth keeping or fixing. Pick the entry points that would help you capture it then and find it again. Add the page or candidate you were looking at if it matters.",
    choices: [
      "On the page or workflow I’m using",
      "On the exact artwork, film or candidate I’m reviewing",
      "In the question or brief that asked me to make a choice",
      "In Saved feedback when a first impression needs more thought",
    ],
    source: [
      "Read how Decisions fits into the workflow",
      "https://composer.loftwah.com/articles/asking-the-ai-twice",
    ],
  },
  {
    id: "composer-opening-design",
    previous: "composer-homepage-promise",
    project: "App Composer",
    category: "Creative review",
    tags: ["homepage", "visual direction", "first action"],
    question: "What should visually lead the Composer homepage?",
    context:
      "The current phone opening keeps the workshop artwork and a direct path to Get Ready. The earlier opening put three working examples immediately under its main action. Compare the actual screens before choosing what the next composition should emphasise.",
    choices: [
      "Keep the workshop artwork with the direct Build your first app action",
      "Put one visible working app and its build path first",
      "Put a small set of starting points first, as in the earlier opening",
    ],
    source: ["Try Build your first app", "https://composer.loftwah.com/"],
    visualComparison: true,
  },
  {
    id: "studio-opening-design",
    previous: "studio-commission-purpose",
    project: "Media Studio",
    category: "Creative review",
    tags: ["first action", "film", "visual direction"],
    question:
      "What should a first-time Media Studio visitor see beside the editing tools?",
    context:
      "The current opening makes Clip, Image and Audio tools easy to reach and names a finished film. The earlier opening led with a larger block of editing actions and put the artefact later. Decide how much of the real work earns space in the opening.",
    choices: [
      "Keep the direct editing actions and one finished film in view",
      "Lead with the actual finished piece and show the matching edit action beside it",
      "Give the editing tools the opening and put the finished work further down",
    ],
    source: [
      "Compare the current Media Studio opening",
      "https://media.loftwah.com/",
    ],
    visualComparison: true,
  },
  {
    id: "share-opening-design",
    previous: "share-wall-discovery",
    project: "Share",
    category: "Creative review",
    tags: ["gallery", "visual direction", "search"],
    question: "What should earn the first big spot in the Share artwork wall?",
    context:
      "Both phone captures put the poster, palette and social-kit tools above the artwork. Look at how much actual work fits on the first screen and decide what the next layout should emphasise.",
    choices: [
      "Keep a compact tool strip and bring more work into the first screen",
      "Give one striking piece the lead, with the rest of the wall immediately below",
      "Open with the mixed artwork wall and move tools to a separate view",
    ],
    source: [
      "Browse the current artwork wall",
      "https://composer.loftwah.com/share?view=artwork",
    ],
    visualComparison: true,
  },
];

export const replacedDecisions = new Set([
  "composer-feedback-entry",
  ...briefs
    .filter((brief) => !brief.visualComparison)
    .map((brief) => brief.previous),
  "public-card-proof",
]);

const individuallyChoose = new Set([
  "composer-homepage-promise",
  "studio-commission-purpose",
  "composer-opening-design",
  "studio-opening-design",
  "share-opening-design",
]);
export const feedbackFollowUps: Decision[] = briefs.map((brief) => ({
  id: brief.id,
  archived: replacedDecisions.has(brief.id),
  project: brief.project,
  category: brief.category,
  tags: brief.tags,
  followUpTo: brief.previous,
  question: brief.question,
  context: brief.context,
  maxSelections: individuallyChoose.has(brief.id) ? 1 : brief.choices.length,
  sources: [
    { label: brief.source[0], url: brief.source[1] },
    ...(brief.visualComparison
      ? [
          {
            label: "Compare the captured phone layouts",
            url: "https://github.com/loftwah/app-composer/blob/main/docs/design-evidence/20261128/quick/README.md",
          },
        ]
      : []),
  ],
  options: brief.choices.map((title, index) => ({
    id: ["first", "second", "third", "fourth", "fifth"][index],
    title,
    pitch: "",
    outcome: "",
    pro: "",
    con: "",
  })),
}));
