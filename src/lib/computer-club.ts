export const trivia = [
  {
    question: "What is HTTP 418 famously called?",
    options: ["Loop detected", "I’m a teapot", "Too early", "Gone"],
    answer: 1,
    explanation: "The April Fools’ coffee-pot RFC gives 418 to a teapot asked to brew coffee.",
    source: "https://www.rfc-editor.org/rfc/rfc2324#section-2.3.2",
  },
  {
    question: "Which Git reference points to the current branch when you’re on one?",
    options: ["HEAD", "ORIG_HEAD", "FETCH_HEAD", "MERGE_HEAD"],
    answer: 0,
    explanation: "HEAD usually names the branch you are on. In detached mode it points directly at a commit.",
    source: "https://git-scm.com/docs/git-symbolic-ref",
  },
  {
    question: "Which permission class has the write bit in Unix mode 0755?",
    options: ["Everyone", "Owner only", "Group only", "Nobody"],
    answer: 1,
    explanation: "7 is read, write and execute. Each 5 is read and execute.",
    source: "https://man.openbsd.org/chmod.1",
  },
  {
    question: "Which Git command records a new commit that undoes an earlier commit?",
    options: ["git reset", "git restore", "git revert", "git reflog"],
    answer: 2,
    explanation: "git revert records the inverse changes in a new commit.",
    source: "https://git-scm.com/docs/git-revert",
  },
  {
    question: "In ASCII, what decimal number represents uppercase A?",
    options: ["64", "65", "97", "10"],
    answer: 1,
    explanation: "Uppercase A is hexadecimal 41, or decimal 65. Lowercase a is decimal 97.",
    source: "https://www.rfc-editor.org/rfc/rfc20",
  },
  {
    question: "In which year did CERN make the original Web software public domain?",
    options: ["1989", "1991", "1993", "1995"],
    answer: 2,
    explanation: "On 30 April 1993, CERN put three components of the World Wide Web software into the public domain.",
    source: "https://home.cern/science/computing/the-birth-of-the-web/licensing-web/",
  },
] as const;

export const crossword = [
  "D....",
  "N.R..",
  "SHELL",
  "..D.I",
  "..I.N",
  "..S.T",
] as const;

export const crosswordNumbers: Record<string, number> = {
  "0-0": 1, "1-2": 2, "2-0": 3, "2-4": 4,
};

export const fuses = [
  { answer: "ROLLBACK", hint: "Time travel for a release, minus the paradox." },
  { answer: "SYMLINK", hint: "A signpost that points to another file or directory." },
  { answer: "CHECKSUM", hint: "A quick way to tell if the bytes survived the trip." },
  { answer: "DEAD LETTER", hint: "Where the message goes when the queue has given up on delivery." },
] as const;
