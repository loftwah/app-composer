export const experiences = {
  "pick-a-door": {
    title: "Pick a Door",
    description: "Three entrances. Ten endings. One very questionable building.",
    slug: "pick-door",
    imageDescription: "Three strange doors down a violet corridor.",
    theme: "cinema",
  },
  "top-nine": {
    title: "Your Top Nine",
    description: "Give nine things you love their own exhibition.",
    slug: "top-nine",
    imageDescription: "Nine exhibits in a violet museum.",
    theme: "museum",
  },
  "tech-bingo": {
    title: "Tech Hot-Take Bingo",
    description: "Mark the things you’ve heard. Bring receipts when you get five in a row.",
    slug: "hot-take-bingo",
    imageDescription: "A red and black punk print full of familiar tech arguments.",
    theme: "gig",
  },
} as const;

export type ExperienceId = keyof typeof experiences;
export const experiencePath = (id: ExperienceId) => `/share/experiences/${id}`;
export const experienceArt = (id: ExperienceId) =>
  `/campaign/internet-workshop-20261122/${experiences[id].slug}-v1.jpg`;
export const experienceOg = (id: ExperienceId) =>
  `/campaign/internet-workshop-20261122/${experiences[id].slug}-og-v1.jpg`;

export const doorRooms = [
  ["The Patch Room", "A workshop that only opens for unfinished business."],
  ["The Department of Tabs", "A perfectly ordinary office with 4,096 open windows."],
  ["The Unlisted Garden", "The Internet’s smallest community has planted a new page."],
] as const;

export const doorChoices = [
  ["Repair the prototype", "Pull the orange lever", "Read the logbook"],
  ["Close all the tabs", "Inspect the last tab", "Follow the printer", "Try the lift"],
  ["Open the seed packet", "Take the paper map", "Leave a tool behind"],
] as const;

export const doorEndings = [
  ["The Do-Over", "The prototype works after one tiny change. Somebody left excellent notes. You write one of your own."],
  ["The Maintenance Disco", "The lights go out. The backup comes on with a bass line. Apparently the UPS has a resident DJ."],
  ["The Footnote", "The first maintainer signed this log in 1998. The last entry reads: someone will be glad you wrote this down."],
  ["The Quiet Desktop", "You close every window. A final alert thanks you for freeing 47 tabs from their contractual obligations."],
  ["The Forever Bookmark", "The last tab opens a hand-built directory. One link still works. It points to a tiny app that solves your whole afternoon."],
  ["The Receipt Goblin", "The printer produces one page: what shipped, when, and who can turn it off. It asks you to frame it."],
  ["The Waiting Room", "The lift will arrive right after the build. You meet three excellent friends and start a project together."],
  ["The Public Patch", "Each seed grows a tool anyone can use. The packet says to keep a few seeds for the next person."],
  ["The Small Web", "The map leads to a bench where people leave links to things they actually made. There’s room for one more."],
  ["The Borrowed Spanner", "Someone takes the tool, fixes the gate and leaves it sharper than before. The garden gains a new entrance."],
] as const;

export const exhibitionPrompts = [
  "Nine games that made me", "My internet hall of fame", "Nine albums I took everywhere",
  "Tools I keep coming back to", "Favourite places on the small web", "Films I still think about",
  "Nine things I learned the hard way", "Books I wish I could reread for the first time",
  "Favourite pieces of hardware", "Nine projects I’m glad exist",
] as const;

export const developerBingo = [
  "Just rewrite it", "Clear your cache", "We need a queue", "It’s DNS", "Works on my machine",
  "Have you tried rolling back?", "Put it behind a flag", "One quick refactor", "Who owns this?", "Ship it Friday",
  "PR is ready", "Rebase again", "Change is in staging", "Zero downtime", "Quick sync?",
  "Use a monorepo", "Split the monorepo", "It’s just config", "Where are the logs?", "That’s tech debt",
  "The flaky test passed", "Write a README", "Can we self-host?", "Let’s do it Monday",
] as const;

export const agentBingo = [
  "Open a fresh chat", "It lost the context", "Try a smaller model", "The next model fixes it", "Bump the thinking",
  "It says it deployed", "Ask a second agent", "No, the other branch", "That screenshot is old", "Give it the logs",
  "Fifty tool calls later", "Don’t touch main", "It reformatted everything", "The prompt is the spec", "The brief was one line",
  "Show the diff", "Who approved that?", "That URL is fake", "It made a checklist", "Use my actual account",
  "The build is still running", "Please just finish", "It removed the tests", "Check production yourself",
] as const;

export const internetBingo = [
  "Bring back forums", "Where’s the RSS feed?", "I miss IRC", "Lost media", "It was on a webring",
  "Internet is dead", "Download the archive", "Bring back guestbooks", "Did you save the page?", "Try the Wayback Machine",
  "This domain expired", "Join our Discord", "That’s an old screenshot", "No account needed", "I used to run a blog",
  "That sounds like dial-up", "My friend had that avatar", "The embed broke", "Read the source", "Bring back Winamp",
  "Nobody updates this wiki", "Scroll to the credits", "Make a personal site", "Somebody mirror this",
] as const;
