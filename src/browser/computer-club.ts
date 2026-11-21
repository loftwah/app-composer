import { crossword, fuses, trivia } from "../lib/computer-club.ts";

async function copy(text: string, status: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied.";
  } catch {
    status.textContent = text;
  }
}

function shareText(text: string, section: string) {
  const url = new URL(location.pathname, location.origin);
  url.hash = section;
  return `${text} ${url.href}`;
}

function mountTrivia(root: HTMLElement) {
  const question = root.querySelector<HTMLElement>("[data-question]")!;
  const options = root.querySelector<HTMLElement>("[data-options]")!;
  const feedback = root.querySelector<HTMLElement>("[data-quiz-feedback]")!;
  const progress = root.querySelector<HTMLElement>("[data-progress]")!;
  const source = root.querySelector<HTMLAnchorElement>("[data-quiz-source]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-next]")!;
  const share = root.querySelector<HTMLButtonElement>("[data-share-score]")!;
  let index = 0;
  let score = 0;

  function show() {
    const q = trivia[index];
    if (!q) {
      progress.textContent = "Round complete";
      question.textContent = `${score} out of ${trivia.length}`;
      feedback.textContent = "";
      options.replaceChildren();
      next.textContent = "Play again";
      next.hidden = false;
      share.hidden = false;
      source.hidden = true;
      return;
    }
    progress.textContent = `Question ${index + 1} of ${trivia.length}`;
    question.textContent = q.question;
    feedback.textContent = "";
    source.hidden = next.hidden = share.hidden = true;
    next.textContent = "Next question";
    const buttons = q.options.map((answer, choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = `${"ABCD"[choice]}. ${answer}`;
      button.addEventListener("click", () => {
        if (!next.hidden) return;
        const right = choice === q.answer;
        if (right) score += 1;
        buttons.forEach((answerButton, number) => {
          answerButton.disabled = true;
          if (number === q.answer) answerButton.dataset.correct = "";
        });
        feedback.textContent = `${right ? "Correct." : `Answer: ${q.options[q.answer]}.`} ${q.explanation}`;
        source.href = q.source;
        source.hidden = next.hidden = false;
        next.focus();
      });
      return button;
    });
    options.replaceChildren(...buttons);
  }
  next.addEventListener("click", () => {
    if (index >= trivia.length) { index = 0; score = 0; }
    else index += 1;
    show();
    question.focus();
  });
  share.addEventListener("click", () => {
    void copy(shareText(`I got ${score}/${trivia.length} in App Composer Computer Trivia.`, "trivia"), feedback);
  });
  show();
}

function mountCrossword(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>("[data-crossword]")!;
  const cells = [...form.querySelectorAll<HTMLInputElement>("input")];
  const status = root.querySelector<HTMLElement>("[data-grid-status]")!;
  const share = root.querySelector<HTMLButtonElement>("[data-share-grid]")!;
  for (const cell of cells) {
    cell.addEventListener("input", () => { share.hidden = true; status.textContent = ""; });
    cell.addEventListener("keydown", (event) => {
      const step: Record<string, readonly [number, number]> = {
        ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
      };
      if (!Object.hasOwn(step, event.key)) return;
      const [row, col] = step[event.key];
      const neighbour = cells.find(input => Number(input.dataset.row) === Number(cell.dataset.row) + row &&
        Number(input.dataset.col) === Number(cell.dataset.col) + col);
      if (neighbour) { event.preventDefault(); neighbour.focus(); }
    });
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const solved = cells.every(input =>
      input.value.toUpperCase() === crossword[Number(input.dataset.row)][Number(input.dataset.col)]);
    share.hidden = !solved;
    status.textContent = solved ? "Solved." : "There’s a letter out of place. Try the intersecting clues.";
  });
  share.addEventListener("click", () => void copy(shareText("I solved App Composer’s Computer Mini.", "crossword"), status));
}

function mountFusebox(root: HTMLElement) {
  const hint = root.querySelector<HTMLElement>("[data-fuse-hint]")!;
  const word = root.querySelector<HTMLElement>("[data-fuse-word]")!;
  const letters = root.querySelector<HTMLElement>("[data-letters]")!;
  const status = root.querySelector<HTMLElement>("[data-fuse-status]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-next-word]")!;
  const share = root.querySelector<HTMLButtonElement>("[data-share-fuses]")!;
  let index = 0;
  let misses = 0;
  let guessed = new Set<string>();
  const buttons = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter) => {
    const button = document.createElement("button");
    button.className = "secondary";
    button.type = "button";
    button.textContent = letter;
    button.addEventListener("click", () => {
      guessed.add(letter);
      if (!fuses[index].answer.includes(letter)) misses += 1;
      show();
      if (next.hidden) {
        const nextLetter = buttons.slice(buttons.indexOf(button) + 1).find((candidate) => !candidate.disabled)
          ?? buttons.find((candidate) => !candidate.disabled);
        nextLetter?.focus();
      }
    });
    return button;
  });
  letters.replaceChildren(...buttons);

  function show() {
    const { answer, hint: clue } = fuses[index];
    hint.textContent = clue;
    const solved = [...answer].every((letter) => letter === " " || guessed.has(letter));
    const finished = solved || misses >= 6;
    word.textContent = [...answer].map((letter) =>
      letter === " " ? "／" : finished || guessed.has(letter) ? letter : "·"
    ).join(" ");

    buttons.forEach((button) => { button.disabled = finished || guessed.has(button.textContent ?? ""); });
    next.hidden = !finished;
    share.hidden = !solved;
    status.textContent = solved ? `Solved with ${6 - misses} fuses left.`
      : finished ? `Out of fuses. The word was ${answer}.` : `${6 - misses} fuses left.`;
    const pattern = document.createElement("span");
    pattern.className = "club-sr-only";
    pattern.textContent = " Word: " + (finished ? answer : word.textContent.replaceAll("·", "blank"));
    status.append(pattern);
    if (finished) next.focus();
  }
  next.addEventListener("click", () => {
    index = (index + 1) % fuses.length;
    misses = 0;
    guessed = new Set();
    show();
    buttons[0].focus();
  });
  share.addEventListener("click", () => void copy(shareText(`I cracked Fusebox with ${6 - misses} fuses left.`, "fusebox"), status));
  show();
}

export function mountComputerClub(root: HTMLElement) {
  mountTrivia(root);
  mountCrossword(root);
  mountFusebox(root);
}
