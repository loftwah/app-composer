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
  "this-or-that": {
    title: "This or That",
    description: "Five friendly either-ors about how you make things. Pick a side, undo if you change your mind.",
    // The stage reuses the owned Internet Workshop “million-question” billboard,
    // itself a maker’s either-or; see public/campaign/internet-workshop-20261122/provenance.json.
    slug: "million-question",
    imageDescription: "A vivid game-show billboard: a tired maker at a lit desk chooses between a red card reading a year of free time and one reading a million dollars.",
    theme: "billboard",
  },
  "twenty-one-questions": {
    title: "21 Questions",
    description: "A naturalist’s interview with your life online: twenty-one questions, one at a time. Answers stay in this tab.",
    // The stage reuses the owned Internet Workshop “internet-specimen” slide, a
    // museum label for a creature of the internet; see
    // public/campaign/internet-workshop-20261122/provenance.json.
    slug: "internet-specimen",
    imageDescription: "An amber museum slide holding a small white owl with keyboard-pattern feathers, labelled Internet Specimen.",
    theme: "museum",
  },
  "developer-type": {
    title: "Developer Type Quiz",
    description: "Eight small situations about how you work on a project. Find your type and learn about a service that fits.",
    // The stage reuses the owned Internet Workshop “which-cloudflare”
    // collectible card; see public/campaign/internet-workshop-20261122/provenance.json.
    slug: "which-cloudflare",
    imageDescription: "An antique silver etching of an orbital library on a midnight-blue collectible card.",
    theme: "museum",
  },
  "language-type": {
    title: "Language Type Quiz",
    description: "Eight ordinary project moments about how you like to make things. Find your type and meet a language that fits.",
    // The stage reuses the owned Internet Workshop “what-build” exhibition
    // poster; see public/campaign/internet-workshop-20261122/provenance.json.
    slug: "what-build",
    imageDescription: "A vast canyon of impossible small working inventions under huge type reading “What would you build?”.",
    theme: "exhibition",
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

/** This or That starter, #1064 early slice: five friendly explicit choices
 * sharing one motif — the habits of making things with code and craft.
 * Each entry is the question prompt, then the two choices, always in that order. */
export const thisOrThatQuestions = [
  ["A free Saturday lands in your lap.", "Start something brand new", "Finish the nearly-done thing"],
  ["Your best making hour is…", "Early morning, first coffee", "Late night, headphones on"],
  ["The build stops cooperating.", "Walk away and come back fresh", "Push through, it’s nearly there"],
  ["A shiny new tool crosses your feed.", "Try it this weekend", "Stick with the tools I know"],
  ["It finally works.", "Write it down while it’s fresh", "Show someone right away"],
] as const;
export const thisOrThatResultTitle = "Your maker rhythm";

/** #1064 food starter: five original sweet-or-spicy either-ors, all written
 * from the point of view of someone making food for people they like. Each
 * entry is the prompt, then the two exact choice texts, always in that order. */
export const sweetOrSpicyQuestions = [
  ["You have one tray left in the oven.", "Sticky cinnamon buns", "Harissa roasted cauliflower"],
  ["A friend texts: bring a snack.", "Honey shortbread", "Chilli lime cashews"],
  ["It’s your turn to pick the film food.", "Caramel popcorn", "Chilli salt popcorn"],
  ["The recipe asks for one bold pinch.", "Cardamom and orange zest", "Smoked paprika and chilli"],
  ["There’s one bite left on the shared plate.", "The honey-glazed one", "The chilli-dusted one"],
] as const;
export const sweetOrSpicyResultTitle = "Your sweet-or-spicy side";

/** #1068 games starter: five original PC-or-console either-ors about how
 * someone plays, all written from one point of view. Each entry is the prompt,
 * then the two exact choice texts, always in that order. Purely authored text:
 * no game artwork, franchise or external asset is reused. */
export const gamesQuestions = [
  ["Your perfect setup starts with…", "A mechanical keyboard and a big monitor", "A controller and the couch"],
  ["Game night with friends means…", "A headset and a busy voice chat", "Pass the controller around the sofa"],
  ["The upgrade you save for is…", "A faster graphics card", "A bigger television"],
  ["After a great run, you want to keep…", "A clip of the last ten seconds", "A screenshot of the final score"],
  ["When a new game lands, you…", "Dial in the graphics settings", "Press start and learn as you go"],
] as const;
export const gamesResultTitle = "Your play style";

/** #1064 named starters: five more packs, each five original either-ors about
 * an ordinary part of life. Written for a phone card — a short prompt and two
 * natural labels — with no borrowed franchise, title or character. Each pack
 * keeps its own concise result heading. */
export const filmAndTvQuestions = [
  ["Film night, sofa claimed.", "Lights off, phone in a drawer", "Chatting through the first scene"],
  ["A series hooks you at episode two.", "Watch the rest tonight", "Ration one a night"],
  ["The credits start rolling.", "Sit through to the very end", "Straight up for the kettle"],
  ["Someone asks what to watch.", "An old favourite, again", "Something none of us have seen"],
  ["The plot wobbles halfway.", "Give it twenty more minutes", "Switch to the backup pick"],
] as const;
export const filmAndTvResultTitle = "Your watch habit";

export const booksAndMusicQuestions = [
  ["A slow afternoon opens up.", "Finish the book you started", "Play an album start to finish"],
  ["An hour of deep focus.", "Instrumental on repeat", "Silence and a closed door"],
  ["A friend lends you something.", "Novel with a cracked spine", "Record with a note inside"],
  ["The last page, the final track.", "Sit with it a while", "Start the next one"],
  ["Packing for a long trip.", "Two books and headphones", "One book and a window seat"],
] as const;
export const booksAndMusicResultTitle = "Your quiet company";

export const travelQuestions = [
  ["A free weekend appears.", "A train to somewhere new", "The same coast as always"],
  ["Packing the small bag.", "One outfit, worn twice", "Options for every weather"],
  ["First morning away.", "Walk until you find breakfast", "Ask the front desk"],
  ["The map has one gap.", "Follow the thin road", "Head back to the square"],
  ["Last hour before heading home.", "One more museum", "Coffee and people-watching"],
] as const;
export const travelResultTitle = "Your travel pace";

export const technologyQuestions = [
  ["A new device arrives.", "Set it up before dinner", "Leave it boxed till the weekend"],
  ["The update prompt appears.", "Install it now", "Remind me next week"],
  ["Your cable drawer opens.", "Keep one of each", "Bin what I can’t name"],
  ["Something stops working.", "Search for the exact error", "Restart and hope"],
  ["You recommend one thing.", "Keyboard I’ve had for years", "App that saves me an hour"],
] as const;
export const technologyResultTitle = "Your setup instinct";

export const everydayQuestions = [
  ["The alarm goes off early.", "Up and out the door", "Ten more minutes, properly"],
  ["The fridge is nearly empty.", "Cook whatever’s left", "Walk to the corner shop"],
  ["A free evening at home.", "Tidy one small corner", "Nothing, and enjoy it"],
  ["Your phone buzzes in a queue.", "Answer it now", "Let it wait"],
  ["Sunday night, week ahead.", "Write the list", "Keep it in my head"],
] as const;
export const everydayResultTitle = "Your ordinary week";

/** All starters share one controller. The pack key travels in a result link
 * so a shared result reopens the exact starter; an absent or unknown key keeps
 * the original maker rhythm, unchanged. */
export const thisOrThatPacks = {
  maker: {
    questions: thisOrThatQuestions,
    title: thisOrThatResultTitle,
    description: experiences["this-or-that"].description,
  },
  food: {
    questions: sweetOrSpicyQuestions,
    title: sweetOrSpicyResultTitle,
    description: "Five original sweet-or-spicy either-ors from the kitchen. Pick a side, undo if you change your mind.",
  },
  games: {
    questions: gamesQuestions,
    title: gamesResultTitle,
    description: "Five choices about your setup and how you play.",
  },
  "film-tv": {
    questions: filmAndTvQuestions,
    title: filmAndTvResultTitle,
    description: "Five choices about how you watch, from opening credits to the last scene.",
  },
  "books-music": {
    questions: booksAndMusicQuestions,
    title: booksAndMusicResultTitle,
    description: "Five either-ors for pages, playlists and the sound of a slow afternoon.",
  },
  travel: {
    questions: travelQuestions,
    title: travelResultTitle,
    description: "Five small decisions from the first train out to the last hour away.",
  },
  technology: {
    questions: technologyQuestions,
    title: technologyResultTitle,
    description: "Five choices about the devices, updates and cables in your everyday orbit.",
  },
  everyday: {
    questions: everydayQuestions,
    title: everydayResultTitle,
    description: "Five ordinary moments, and the small call you make in each one.",
  },
} as const;
export type ThisOrThatPack = keyof typeof thisOrThatPacks;

/** #1064 twenty-one questions: one authored naturalist’s interview about a
 * person’s life online — habitat, rhythm, reading, making, memory and one
 * closing line. Written for the specimen stage; every answer is the player’s
 * own and never leaves the current screen. */
export const twentyOneQuestions = [
  "When does your internet day usually start?",
  "What does your main screen sit on?",
  "Name the tab you never close.",
  "What do you read most online?",
  "Which sound means a good session?",
  "How many tabs are open right now, honestly?",
  "Where do your bookmarks actually live?",
  "Which website feels most like home?",
  "Name a small site you’d hate to lose.",
  "What do you make most often?",
  "Which tool opens first when you work?",
  "Where do your unfinished drafts go?",
  "What do you do when something breaks late at night?",
  "Which online habit are you trying to quit?",
  "What’s one thing the internet taught you the hard way?",
  "Who taught you the most online?",
  "What do you back up that others wouldn’t think to?",
  "Which message from this year stayed with you?",
  "What do you check even when nothing’s new?",
  "What would you show someone brand new here?",
  "Finish it: the internet is…",
] as const;
export const twentyOneResultTitle = "Your internet specimen";
