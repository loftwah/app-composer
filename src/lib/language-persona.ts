import { experiencePath } from "./share-experiences.ts";
import {
  createPersonaQuiz,
  type PersonaOutcome, type PersonaQuestion,
} from "./persona-quiz.ts";

/** “Which programming language are you?” — the sibling pack for the shared
 * persona engine (#1071/#1069). The eight results are playful archetypes, not
 * a skills test, a job match or a claim about any person. Each language note is
 * one accurate detail checked against the official documentation page named by
 * its `href` on 24 November 2026. Plain names only: no project logo, word-mark
 * styling or implied endorsement.
 *
 * The questions describe ordinary project moments. None of them asks what a
 * language does, so a result never depends on prior programming knowledge.
 * Answers and scores stay on the page; sharing carries one outcome ID in the
 * link fragment. */

export const languagePersonaChecked = "24 November 2026";

const languagePersonaSource = {
  ruby: {
    label: "Ruby",
    archetype: "The Expressive Craftsperson",
    tendency: "You care about how clearly your work reads and how well it runs.",
    reason: "Ruby is designed to feel natural to read, and blocks let you pass a piece of work to a method.",
    href: "https://www.ruby-lang.org/en/about/",
  },
  python: {
    label: "Python",
    archetype: "The Curious Generalist",
    tendency: "You would rather understand the whole problem than specialise too early.",
    reason: "Python is an interpreted, dynamically typed language with a broad standard library.",
    href: "https://docs.python.org/3/tutorial/index.html",
  },
  rust: {
    label: "Rust",
    archetype: "The Careful Engineer",
    tendency: "You are happiest when the risky parts are handled before they bite.",
    reason: "Rust uses ownership rules to manage memory safely, so whole classes of bug are caught before the program runs.",
    href: "https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html",
  },
  typescript: {
    label: "TypeScript",
    archetype: "The Thoughtful Organiser",
    tendency: "You like names, shapes and a plan other people can follow.",
    reason: "TypeScript adds static type checks to JavaScript, so some mistakes surface before the code runs.",
    href: "https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html",
  },
  javascript: {
    label: "JavaScript",
    archetype: "The Improviser",
    tendency: "You would rather have something real to poke at than a perfect plan.",
    reason: "JavaScript is standardised by ECMAScript, and host environments such as browsers give the language somewhere to run.",
    href: "https://tc39.es/ecma262/",
  },
  go: {
    label: "Go",
    archetype: "The Focused Minimalist",
    tendency: "You want the smallest set of parts that does the job properly.",
    reason: "Go ships with its own documentation and tooling for building, testing and formatting code.",
    href: "https://go.dev/doc/",
  },
  elixir: {
    label: "Elixir",
    archetype: "The Team Synchroniser",
    tendency: "You notice when people and processes need to move together.",
    reason: "The official Elixir documentation collects the language guides in one place.",
    href: "https://elixir-lang.org/docs/",
  },
  php: {
    label: "PHP",
    archetype: "The Practical Web Builder",
    tendency: "You like a working page in front of real people by the end of the day.",
    reason: "PHP is a server-side scripting language used to build dynamic HTML for the web.",
    href: "https://www.php.net/intro",
  },
} as const satisfies Record<string, PersonaOutcome>;

export type LanguagePersonaId = keyof typeof languagePersonaSource;

/** Original, situation-based questions, each answered by what the player would
 * rather do. Every language is a primary choice four times and a secondary
 * four times, so every result is reachable without the tie-break. */
const languagePersonaQuestionData = [
  {
    id: "fresh-idea",
    prompt: "A fresh idea lands with no plan attached.",
    options: [
      { label: "Say it out loud and make it feel real", primary: "ruby", secondary: "elixir" },
      { label: "Follow the question until a shape appears", primary: "python", secondary: "javascript" },
      { label: "Write down the rules before anything moves", primary: "rust", secondary: "typescript" },
      { label: "Sketch the pieces and how they fit", primary: "typescript", secondary: "go" },
    ],
  },
  {
    id: "old-notes",
    prompt: "Last week’s notes have stopped making sense.",
    options: [
      { label: "Try the first thing that might explain it", primary: "javascript", secondary: "ruby" },
      { label: "Delete anything that isn’t needed", primary: "go", secondary: "rust" },
      { label: "Ask the group what they remember", primary: "elixir", secondary: "php" },
      { label: "Open the page it was all for and look", primary: "php", secondary: "python" },
    ],
  },
  {
    id: "noticeboard",
    prompt: "A friend wants help with their community noticeboard.",
    options: [
      { label: "Make it welcoming before anything else", primary: "ruby", secondary: "go" },
      { label: "Find out what people actually need first", primary: "python", secondary: "elixir" },
      { label: "Check that nothing can quietly break", primary: "rust", secondary: "javascript" },
      { label: "Agree the labels and where each thing lives", primary: "typescript", secondary: "php" },
    ],
  },
  {
    id: "demo-tomorrow",
    prompt: "The demo is tomorrow and one piece is missing.",
    options: [
      { label: "Improvise something that works tonight", primary: "javascript", secondary: "python" },
      { label: "Make the smallest reliable piece", primary: "go", secondary: "typescript" },
      { label: "Get two helpers working side by side", primary: "elixir", secondary: "ruby" },
      { label: "Put a simple form in front of it", primary: "php", secondary: "rust" },
    ],
  },
  {
    id: "explain-decision",
    prompt: "You have to explain a decision to someone new.",
    options: [
      { label: "Tell it as a short story with a point", primary: "ruby", secondary: "elixir" },
      { label: "Show the path you took to get there", primary: "python", secondary: "javascript" },
      { label: "Point at the rule that made it safe", primary: "rust", secondary: "typescript" },
      { label: "Draw the map of what connects to what", primary: "typescript", secondary: "go" },
    ],
  },
  {
    id: "big-update",
    prompt: "A tool you rely on releases a big update.",
    options: [
      { label: "Click around and see what changed", primary: "javascript", secondary: "ruby" },
      { label: "Read the short list of what is different", primary: "go", secondary: "rust" },
      { label: "Check what the team is saying about it", primary: "elixir", secondary: "php" },
      { label: "Test the page people use most", primary: "php", secondary: "python" },
    ],
  },
  {
    id: "nearly-finished",
    prompt: "A side project is nearly finished.",
    options: [
      { label: "Polish the part people will remember", primary: "ruby", secondary: "go" },
      { label: "Try one last thing you were curious about", primary: "python", secondary: "elixir" },
      { label: "Re-check the edge you were worried about", primary: "rust", secondary: "javascript" },
      { label: "Tidy the names before you stop", primary: "typescript", secondary: "php" },
    ],
  },
  {
    id: "explain-whole",
    prompt: "Someone asks how the whole thing works.",
    options: [
      { label: "Start talking and draw it as you go", primary: "javascript", secondary: "python" },
      { label: "Show the three steps that matter", primary: "go", secondary: "typescript" },
      { label: "Introduce the people who keep it running", primary: "elixir", secondary: "ruby" },
      { label: "Open it up and walk them through the page", primary: "php", secondary: "rust" },
    ],
  },
] as const satisfies readonly PersonaQuestion<LanguagePersonaId>[];

export const languagePersonaQuestions = languagePersonaQuestionData;

export const languagePersonaQuiz = createPersonaQuiz({
  path: experiencePath("language-type"),
  outcomes: languagePersonaSource,
  questions: languagePersonaQuestions,
});

export const languagePersonaOutcomes = languagePersonaSource;
export const languagePersonaIds: LanguagePersonaId[] = [...languagePersonaQuiz.ids];
export const languagePersonaQuestionCount = languagePersonaQuiz.questionCount;
export const languagePersonaPath = experiencePath("language-type");
export const tallyLanguagePersona = languagePersonaQuiz.tally;
export const resolveLanguagePersona = languagePersonaQuiz.resolve;
export const languagePersonaOutcomeFromHash = languagePersonaQuiz.outcomeFromHash;
export const languagePersonaResultPath = languagePersonaQuiz.resultPath;
