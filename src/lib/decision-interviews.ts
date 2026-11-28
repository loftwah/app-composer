import projects from "../data/decision-interview-projects.json";
import inventory from "../../docs/portfolio/woodhouse-inventory-20261116.json";
import type { Decision } from "./portfolio-decision-contract.ts";

export const preferencesId = "your-preferences";
const labels = ["first", "second", "third", "fourth", "fifth"];
const inventoryById = new Map(
  inventory.projects.map((project) => [project.id, project]),
);
const portfolioRecords = new Set(projects.map(([id]) => id));

export const interviewProjects = projects.map(
  ([id, name, url, job, tasks, proof]) => ({
    id: id as string,
    name: name as string,
    url: url as string,
    job: job as string,
    tasks: tasks as string[],
    proof: proof as string,
    lifecycle: inventoryById.get(id as string)?.lifecycle ?? "active",
  }),
);

// The inventory owns identity/lifecycle. Add unrecognised entries to the index
// even before they have a hand-written interview.
export const indexedProjects = [
  ...interviewProjects,
  ...inventory.projects
    .filter((project) => !portfolioRecords.has(project.id))
    .map((project) => ({
      id: project.id,
      name: project.name,
      url: project.live?.url ?? project.dossier,
      job: project.summary,
      lifecycle: project.lifecycle,
      proof: project.nextProof,
      tasks: [] as string[],
    })),
];

function prompt(
  interview: string,
  name: string,
  suffix: string,
  question: string,
  context: string,
  choices: string[],
  limit: number,
  url: string,
  sourceLabel?: string,
): Decision {
  return {
    id: `interview-${interview}-${suffix}`,
    interview,
    project: name,
    question,
    context,
    maxSelections: limit,
    sources: [
      {
        label:
          sourceLabel ??
          (interview === preferencesId ? "Current Decisions flow" : name),
        url,
      },
    ],
    options: choices.map((title, index) => ({
      id: labels[index],
      title,
      pitch: "",
      outcome: "",
      pro: "",
      con: "",
    })),
  };
}

const composer = "https://composer.loftwah.com/";
const fieldReport = `${composer}articles/asking-the-ai-twice`;
const preferences: [string, string, string, string[], number, string?][] = [
  [
    "visual-lead",
    "What earns a big image on a page?",
    "Think of a page you would actually open twice. Add a link or describe what made the image matter.",
    [
      "A real finished thing I want to open",
      "A working product or process I can recognise",
      "A strong piece of original art with a story",
      "A useful file or resource I can take",
      "It varies by the job the page has",
    ],
    3,
  ],
  [
    "visual-turnoff",
    "What makes you dismiss a design early?",
    "Choose the signals you actually notice. A specific example in the note is worth more than a label.",
    [
      "Generic or unrelated artwork",
      "Muddy colour or effects over everything",
      "Too much copy before I can do anything",
      "A polished image with nothing useful behind it",
      "A familiar safe layout with no character",
    ],
    3,
  ],
  [
    "visual-bold",
    "Where do you want us to push harder?",
    "Pick where you would most want to see a more ambitious attempt. Add a boundary if there is one.",
    [
      "Typography and composition",
      "Real artwork and original characters",
      "Motion and interaction",
      "Colour and contrast",
      "Ideas, themes and the things we choose to show",
    ],
    3,
  ],
  [
    "references",
    "Which references help us understand your taste?",
    "Name a product, artwork, game, video or specific screen. Explain what to borrow and what belongs to that reference alone.",
    [
      "Products I use repeatedly",
      "Art or creative work I would share",
      "Games that feel good to operate",
      "Social posts I actually stop for",
      "Examples that show what to avoid",
    ],
    3,
  ],
  [
    "share-like",
    "What are you most likely to keep from Share?",
    "Think of something you saved or wished you could find. Add a title, link or description.",
    [
      "An editable original",
      "A distinctive palette or design treatment",
      "An image or film worth revisiting",
      "A useful workflow or example",
      "A source with good context and credit",
    ],
    3,
  ],
  [
    "share-dislike",
    "What should we show less often in Share?",
    "Think about the last time discovery felt like work.",
    [
      "Near-identical versions",
      "Visually loud work without a good subject",
      "Items without useful source details",
      "Old work with no current purpose",
      "Named collections that obscure the best items",
    ],
    3,
  ],
  [
    "knowledge",
    "Where can agents assume you already know the terrain?",
    "Add a specific area in the note. This changes how much background belongs in a brief.",
    [
      "Product and design context",
      "Build and deployment workflows",
      "Media production and editing",
      "Games and their mechanics",
      "It depends on the project",
    ],
    4,
  ],
  [
    "unknowns",
    "What would you like to understand better from real examples?",
    "Name a specific gap if the options are broad. This is about what you want explained.",
    [
      "What a project can do today",
      "How an output was made",
      "How to judge alternatives and trade-offs",
      "How to operate or reproduce the workflow",
      "What evidence would change the next decision",
    ],
    3,
  ],
  [
    "delegation",
    "Which decisions should agents take without asking?",
    "Think about repeat work. Add examples where authority depends on context.",
    [
      "Routine implementation and reversible details",
      "Choosing the first batch of references",
      "Ruling out weak options before review",
      "Integrating and verifying authorised changes",
      "Ask me when the choice would materially redirect the work",
    ],
    4,
  ],
  [
    "review",
    "When should we bring you into a creative decision?",
    "Tell us when your input changes the outcome, and what you need in hand by then.",
    [
      "When the purpose or audience is unclear",
      "When there are real rough options to compare",
      "After strong candidates are working at their actual size",
      "Before irreversible publication",
      "When competing priorities make the choice meaningful",
    ],
    3,
  ],
  [
    "evidence",
    "What do you want to see before believing a change worked?",
    "Think about the difference between seeing a result and hearing it shipped.",
    [
      "Direct link to the exact working result",
      "Real before and after at the size people use",
      "A person completing the actual task",
      "Exact release and verification record",
      "Alternatives and the reason we chose one",
    ],
    3,
  ],
  [
    "feedback",
    "How should an agent act on your feedback?",
    "Name a useful follow-up or a response pattern you dislike.",
    [
      "Make a first correction and show the result",
      "Record the reason against the exact item",
      "Ask only when the direction is genuinely ambiguous",
      "Compare with a stronger outside example",
      "Keep the other requested work moving",
    ],
    3,
  ],
  [
    "regression-replay",
    "Which repeat failure should we turn into a regression exercise first?",
    "Pick a case where you had to ask twice. Add the project, what the agent missed and what a useful first attempt would have looked like.",
    [
      "A campaign led with artwork for the wrong job",
      "A phone interaction looked fine until I used it",
      "A save or export looked successful but lost something",
      "A release was reported without a real production check",
      "An earlier correction was forgotten in the next project",
    ],
    2,
    fieldReport,
  ],
  [
    "creative-retry",
    "When a creative attempt misses, what should we change first?",
    "Think of a recent draft that felt wrong. Name the actual item, placement or audience so we can choose the right kind of second attempt.",
    [
      "Change the subject or the work we chose to show",
      "Rework what the page or campaign promises",
      "Find a stronger reference and explain what to borrow",
      "Keep the idea and improve composition or execution",
      "Bring several substantially different ideas to compare",
    ],
    2,
    fieldReport,
  ],
  [
    "second-prompt",
    "Which follow-up from you should count as an avoidable interruption?",
    "Add an example of a question you regularly have to repeat when the agent could have answered it from the work, tools or existing decision records.",
    [
      "Asking what actually works in production",
      "Pointing out a defect in the normal user journey",
      "Restating a standing constraint or previously rejected approach",
      "Asking for the rest of a deliverable the brief already implied",
      "Asking the agent to use tools or evidence already in reach",
    ],
    3,
    fieldReport,
  ],
];
export const preferenceQuestions = preferences.map(
  ([id, question, context, choices, limit, source]) =>
    prompt(
      preferencesId,
      "Your preferences",
      id,
      question,
      context,
      choices,
      limit,
      source ?? composer,
      source ? "I kept asking the AI twice" : undefined,
    ),
);

export const projectInterviewQuestions = interviewProjects.flatMap(
  ({ id, name, url, job, tasks, proof, lifecycle }) => [
    prompt(
      id,
      name,
      "familiarity",
      `How familiar are you with the current ${name} experience?`,
      job + ". Think about the last real session you can remember.",
      [
        "I use it and know where things are",
        "I have used it but would need to explore",
        "I know the idea but have not tried the current version",
        "I would like a short walkthrough",
        "I do not need to use it personally",
      ],
      1,
      url,
    ),
    prompt(
      id,
      name,
      "job",
      `What would you actually open ${name} to do?`,
      lifecycle === "active"
        ? "Choose the real job you would try. Add your situation if it changes the answer."
        : "Choose what is worth preserving or learning from this project. The recorded lifecycle still applies.",
      tasks,
      2,
      url,
    ),
    prompt(
      id,
      name,
      "friction",
      `Where should we look first for problems in ${name}?`,
      `Use a real example if you have one. The jobs on the table include ${tasks.slice(0, 3).join(", ").toLowerCase()}.`,
      [
        "It is hard to find or get into the right place",
        "I cannot tell what to do next",
        "The output or result is unclear",
        "The visual design loses me",
        "I have not tried enough to judge",
      ],
      2,
      url,
    ),
    prompt(
      id,
      name,
      "proof",
      `What would count as good enough to show ${name} to someone else?`,
      `Starting proof to examine: ${proof}. Add your own threshold or point to an example you would gladly share.`,
      [
        "A real person can finish the job",
        "It feels distinctive and worth sharing",
        "The next action and result are clear",
        "The working evidence and limits are easy to inspect",
        "I would want to use it again myself",
      ],
      3,
      url,
    ),
  ],
);

export const interviewQuestions = [
  ...preferenceQuestions,
  ...projectInterviewQuestions,
];

const shareTopics: [string, string, string, string[], number][] = [
  [
    "looking",
    "When you open Share, what are you usually looking for?",
    "Think of the last two times you actually opened it. What did you try to find?",
    [
      "A specific item I already know",
      "Work from a particular person or project",
      "Something I can edit, reuse or learn from",
      "A genuinely good original I can keep or share",
      "I am browsing and want one strong starting point",
    ],
    3,
  ],
  [
    "art-reference",
    "Which kind of original work do you want to see more of?",
    "Choose the work itself. Add links or item titles so the next round has examples it can compare.",
    [
      "Campaign graphics or posters",
      "Finished photos or illustrations",
      "Actual product captures",
      "Original films or motion work",
      "Useful templates, kits or references",
    ],
    3,
  ],
  [
    "good-find",
    "What makes a Share result genuinely useful to you?",
    "Choose the signals that would make you open the item, keep it or use it for a project.",
    [
      "Distinctive craft that holds up full size",
      "A clear explanation of where it came from",
      "An editable or downloadable version",
      "An exact workflow or working example",
      "A collection of related originals with a reason to be together",
    ],
    3,
  ],
  [
    "bury",
    "What would you hide from the default Share view?",
    "This is about the default presentation. Name a real collection or item if you have an example.",
    [
      "Routine exports and near-identical crops",
      "Old campaigns that crowd out relevant work",
      "Low-value standalone images",
      "Duplicates without a clear original",
      "Everything should stay visible if filters are good",
    ],
    3,
  ],
  [
    "search-miss",
    "What should we learn when a Share search fails?",
    "Try a real search or recall a recent one. Add the search terms and what you expected to find.",
    [
      "Which item should have matched",
      "Which project name or alias the search missed",
      "Which attribute or format I needed",
      "Whether I found the item another way",
      "Whether the catalogue lacks that kind of work",
    ],
    3,
  ],
  [
    "film",
    "What makes a film in Share worth watching?",
    "Name a film or a moment you would replay, or say where you would stop watching.",
    [
      "A strong opening with an actual subject",
      "A finished result plus the work behind it",
      "A story or performance I would watch on its own",
      "A clear useful demonstration I can reproduce",
      "Readable captions, good sound and pacing",
    ],
    3,
  ],
  [
    "experiences",
    "Which Share experiences or resources would you come back to?",
    "Try the ones you care about. Say what makes the strongest one worth revisiting.",
    [
      "A playable or interactive experience",
      "A reusable creative tool",
      "A genuinely useful starter",
      "A short tutorial built around real work",
      "An example that helps me see what I could make",
    ],
    3,
  ],
  [
    "followup",
    "What should an agent do with the feedback you leave on a Share item?",
    "Include the project and precise crop, version or placement when they change your answer.",
    [
      "Use it when proposing the next selection",
      "Rework it and show a new candidate",
      "Show less similar work by default",
      "Keep it as a reference for this project",
      "Bring me a meaningfully different comparison",
    ],
    3,
  ],
];
interviewQuestions.push(
  ...shareTopics.map(([id, question, context, choices, limit]) =>
    prompt(
      "share",
      "App Composer Share",
      id,
      question,
      context,
      choices,
      limit,
      `${composer}share`,
    ),
  ),
);
