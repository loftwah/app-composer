import { type ExperienceId, twentyOneQuestions } from "../lib/share-experiences.ts";
import {
  splitTwentyOneCards, twentyOneAnswered, twentyOneCardSize, twentyOneCount, twentyOnePairs,
  twentyOneSquareCardSize,
} from "../lib/twenty-one-questions.ts";
import { coverBox, type CoverFit } from "../lib/top-nine-cover.ts";
import type { PersonaCardPrint } from "../lib/persona-quiz.ts";
import {
  tierListDefaultTitle, tierListRows, tierListTierCount, tierListTiers,
} from "../lib/tier-list.ts";
import {
  wrongAnswerCount, wrongAnswerPlate,
} from "../lib/wrong-answers.ts";
import {
  redFlagCourtCard, redFlagCourtCount, redFlagCourtSubtitle,
  type RedFlagVerdict,
} from "../lib/red-flag-court.ts";
import {
  techTournamentOutcome, techTournamentPickCount,
  type TechTournamentPick,
} from "../lib/tech-tournament.ts";

export const resultSizes = {
  portrait: [1080, 1350], story: [1080, 1920], square: [1080, 1080], wide: [1200, 630],
} as const;
export type ResultFormat = keyof typeof resultSizes;

/** Grid columns for an items export. A five keeps its single full-width column
 * — the built-in This or That drawing is unchanged — while an authored nine
 * reuses the 3 × 3 grid the Top Nine exhibition already prints for exactly
 * nine short texts. One column at nine would squeeze portrait cells to about
 * a third of their height (and far less on square and landscape), dropping
 * option text toward the fit floor; the grid keeps every choice at the same
 * starting size the five uses, in taller cells than the five-row layout.
 * One-must-go prints its four stage choices as a clear 2 × 2. */
export function resultColumns(game: ExperienceId, itemCount: number): 1 | 2 | 3 | 5 {
  if (game === "tech-bingo") return 5;
  if (game === "one-must-go") return 2;
  if (game === "this-or-that") return itemCount === 9 ? 3 : 1;
  return 3;
}
export interface ShareExperienceResult {
  game: ExperienceId;
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Canonical source links per exhibit. Interactive only: exports stay text-only. */
  hrefs?: (string | null)[];
  /** Optional public HTTPS profile link. Interactive preview, draft and result
   * link only: exports and image descriptions never draw or print it. */
  profile?: string;
  /** Optional exact public web page per manually named exhibit. Interactive
   * board, draft and result link only: exports and descriptions never draw or
   * print it, and nothing fetches or embeds it. */
  pages?: (string | null)[];
  /** Tier-list only: entries per row, always four numbers summing to items.
   * The board never becomes a result link, so this stays in the tab. */
  tierSizes?: number[];
  /** Explicit ranked board: occupied slots print #1–#9 in every format.
   * Absent keeps unordered favourites, so old links and drafts stay as they were. */
  ranked?: boolean;
  /** Frozen authored prompts for a private twenty-one-questions run. Card
   * exports only: results never travel in a link, so this stays in the tab. */
  questions?: string[];
  /** The selected prompt and private answer for a Wrong Answers Only export. */
  prompt?: string;
  answer?: string;
  /** Red Flag Court: current docket position and verdict. Memory only, never a link. */
  courtCase?: number;
  verdict?: RedFlagVerdict;
  /** Internet World Cup: seven ordered local picks. Memory only; the winner
   * card is drawn from these and this bracket never becomes a link. */
  tournamentPicks?: (TechTournamentPick | null)[];
  byline: string;
  skin: number;
  background: string;
}

/**
 * Cover art per exhibit, drawn only into the downloaded PNG. It arrives as its
 * own argument — never inside the result snapshot — so no link, draft or JSON
 * path can carry a person's photo bytes.
 */
export type ResultCover = HTMLCanvasElement;

/** One exhibit's export cover: its decoded pixels and the cell fit the person
 * chose beside it. It arrives only in this argument — never inside the result
 * snapshot — so a fit stays exactly as private as the art it shapes. */
export interface ResultCoverSlot {
  art: ResultCover;
  fit: CoverFit;
}

const inks = {
  "pick-a-door": [["#1c102a", "#f8e9d0", "#ffbc65"], ["#e8d9bf", "#251d14", "#8b392c"], ["#182a21", "#eaffd4", "#a7e679"]],
  "top-nine": [["#361c60", "#fff1d5", "#ffbFA0"], ["#f3be78", "#25202a", "#692642"], ["#141f2c", "#e4f1ff", "#a4ccff"]],
  "tech-bingo": [["#841424", "#ffeed7", "#ffd08a"], ["#164934", "#fff6db", "#fdcb63"], ["#ece3d6", "#251a19", "#982b3d"]],
  "this-or-that": [["#10333c", "#f3faf3", "#ff6a4d"], ["#e8ddc4", "#1c2a24", "#b3372a"], ["#10161d", "#dff1ff", "#9fd4ff"]],
  "twenty-one-questions": [["#f0e7d0", "#33202e", "#b06010"], ["#241a33", "#e9ddc6", "#d9a441"], ["#e7ecdc", "#22301f", "#5c7a3f"]],
  // The Developer Type card keeps the museum stage's three established pairs;
  // the Language Type card brings its own warm exhibition pairs.
  "developer-type": [["#321b59", "#fff1d6", "#ffb696"], ["#eab36b", "#211610", "#642342"], ["#131a26", "#dcedff", "#b0ceff"]],
  "language-type": [["#17251c", "#f4f1dc", "#d8f36a"], ["#efe4cf", "#241f17", "#8d3f22"], ["#111820", "#e6f0ff", "#9fd4ff"]],
  // Wine letterpress, marble and cobalt, matching the owned tier-list stage.
  "tier-list": [["#f7ead8", "#2a161b", "#8c2130"], ["#efe4d3", "#251b1d", "#345f9e"], ["#141b2b", "#e7edf8", "#9fc6ff"]],
  // Noir orange, white relief and warm paper, matching the owned one-must-go
  // awards stage.
  "one-must-go": [["#171310", "#fbeee2", "#f07022"], ["#b84317", "#fff3e6", "#ffd9a8"], ["#efe2cf", "#22170f", "#a63817"]],
  // The owned wrong-answers textbook: saffron blueprint ink on aged paper,
  // a faded copy, and a night-school page for the dark skin.
  "wrong-answers": [["#efe0bd", "#3a2412", "#8a4a08"], ["#f7f1e5", "#2a2319", "#7b3f10"], ["#1d1913", "#f4e6c7", "#e6ad3c"]],
  // The owned tabloid courtroom: warm court paper and red ink, a late edition,
  // and a cooler newsprint sheet. The verdict block stays red or green.
  "red-flag-court": [["#f3e4c7", "#1c1511", "#a3151f"], ["#17120f", "#f6ead2", "#d8343f"], ["#e9e4d8", "#1d1b18", "#7a1a1f"]],
  // The owned screenprinted cup: late-night black and sodium orange, an aged
  // newsprint sheet, and a colder floodlight page. All three keep the trophy
  // crop from the same poster.
  "tech-tournament": [["#171310", "#fbeee2", "#f07022"], ["#efe6d3", "#211b16", "#b1461c"], ["#0e1b26", "#e9f4ff", "#ffb347"]],
} as const;

function picture(path: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = path;
  return image.decode().then(() => image);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest bold size at or below `initial` whose wrapped text fits `height`.
 * `family`, `weight` and `lineHeight` default to the long-standing system-ui
 * voice every existing export uses; the Developer Type card opts into the
 * product's own Space display face and tighter display leading. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  initial: number,
  { family = "system-ui", weight = 700, lineHeight = 1.14 }: { family?: string; weight?: number; lineHeight?: number } = {},
) {
  let size = initial;
  let lines: string[] = [];
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    lines = wrap(ctx, text, width);
    if (lines.length * size * lineHeight <= height) break;
    size -= 2;
  } while (size > 12);
  return { size, lines };
}

function drawFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  initial: number,
  options: { family?: string; weight?: number; lineHeight?: number } = {},
) {
  const { size, lines } = fitText(ctx, text, width, height, initial, options);
  const lineHeight = options.lineHeight ?? 1.14;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + size + index * size * lineHeight, width);
  });
}

/** The numbered chip an explicitly ranked Top Nine prints in one occupied slot.
 * It uses the board's accent and paper, so all three skins keep their contrast. */
function rankChipHeight(size: number) {
  return Math.round(size * 1.5);
}

function drawRank(
  ctx: CanvasRenderingContext2D,
  rank: number,
  x: number,
  y: number,
  size: number,
  paper: string,
  accent: string,
) {
  const label = `#${rank}`;
  const pad = Math.round(size * .34);
  const height = rankChipHeight(size);
  ctx.save();
  ctx.font = `800 ${size}px system-ui`;
  const width = Math.ceil(ctx.measureText(label).width) + pad * 2;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = paper;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + pad, y + height / 2 + 1);
  ctx.restore();
  return height;
}

/** The publisher line every exported card carries: the approved mark, the
 * product name and site, and one optional byline. Shared by every experience
 * renderer so single images and card sets sign off identically. */
function signCard(
  ctx: CanvasRenderingContext2D,
  mark: HTMLImageElement,
  width: number,
  margin: number,
  footer: number,
  ink: string,
  byline: string,
) {
  ctx.drawImage(mark, margin, footer, 36, 36);
  ctx.fillStyle = ink;
  ctx.font = "700 24px system-ui";
  ctx.fillText("Made with App Composer", margin + 47, footer + 16);
  ctx.font = "600 18px system-ui";
  ctx.fillText("composer.loftwah.com", margin + 47, footer + 40);
  if (byline) {
    ctx.textAlign = "right";
    ctx.font = "700 24px system-ui";
    ctx.fillText(byline, width - margin, footer + 26, width - margin * 2 - 370);
    ctx.textAlign = "left";
  }
}

const wrongAnswerFace = "Space, system-ui";

/** Wrap one printed plate line. Unlike the established games' wrapper this also
 * breaks a single over-long word, so a 240-character answer can never run off
 * the page at the fit floor. */
function plateWrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (ctx.measureText(word).width <= width) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const character of word) {
      if (chunk && ctx.measureText(chunk + character).width > width) {
        lines.push(chunk);
        chunk = character;
      } else chunk += character;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function plateFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  initial: number,
  lineHeight = 1.06,
) {
  let size = Math.max(12, initial);
  let lines: string[] = [];
  do {
    ctx.font = `700 ${size}px ${wrongAnswerFace}`;
    lines = plateWrap(ctx, text, width);
    if (lines.length * size * lineHeight <= height) break;
    size -= 2;
  } while (size > 12);
  return { size, lines, lineHeight };
}

/** Draw the answer at the top of its panel and return its printed height. */
function drawPlateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  initial: number,
) {
  const { size, lines, lineHeight } = plateFit(ctx, text, width, height, initial);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + size + index * size * lineHeight, width);
  });
  return lines.length * size * lineHeight;
}

/** Draw the question centred in its page area, so a short poster question and
 * a long one both sit deliberately between the masthead and the answer panel. */
function drawPlateCentred(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  initial: number,
) {
  const { size, lines, lineHeight } = plateFit(ctx, text, width, height, initial);
  const block = lines.length * size * lineHeight;
  const top = y + Math.max(0, (height - block) / 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, top + size + index * size * lineHeight, width);
  });
  return block;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, size: number, tracking: number) {
  ctx.save();
  ctx.font = `800 ${size}px system-ui`;
  let width = 0;
  for (const character of text) width += ctx.measureText(character).width + tracking;
  ctx.restore();
  return Math.max(0, width - tracking);
}

/** Small caps with drawn letter spacing, matching the label rhythm of the
 * printed campaign rather than relying on canvas letterSpacing support. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  tracking = Math.max(1, Math.round(size * .12)),
) {
  ctx.save();
  ctx.font = `800 ${size}px system-ui`;
  ctx.fillStyle = colour;
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + tracking;
  }
  ctx.restore();
}

/** The poster's own rubber stamp, drawn as an outlined saffron mark. */
function drawWrongStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  accent: string,
) {
  const label = "WRONG ANSWERS ONLY";
  const tracking = Math.max(1, Math.round(size * .14));
  const padX = Math.round(size * .65);
  const padY = Math.round(size * .42);
  const width = trackedWidth(ctx, label, size, tracking) + padX * 2;
  const height = size + padY * 2;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, Math.round(size * .13));
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
  ctx.restore();
  ctx.save();
  ctx.font = `800 ${size}px system-ui`;
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  let cursor = x + padX;
  for (const character of label) {
    ctx.fillText(character, cursor, y + height / 2 + Math.round(size * .02));
    cursor += ctx.measureText(character).width + tracking;
  }
  ctx.restore();
  return { width, height };
}

/** The index tab at the top-right of the sheet, carrying the question number. */
function drawWrongTab(
  ctx: CanvasRenderingContext2D,
  number: number,
  x: number,
  y: number,
  size: number,
  paper: string,
  accent: string,
) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = paper;
  ctx.font = `800 ${Math.round(size * .38)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number).padStart(2, "0"), x + size / 2, y + size / 2 + 1);
  ctx.restore();
}

/** One local wrong-answer plate: the owned textbook page, the poster stamp, the
 * exact selected question, the exact typed answer, and the same publisher
 * sign-off every card carries. Wide is an open two-page spread; the upright
 * formats stack the question above a correction slip. */
async function renderWrongAnswers(result: ShareExperienceResult, format: ResultFormat): Promise<Blob> {
  const plate = wrongAnswerPlate(result.prompt, result.answer);
  if (!plate) throw new Error("No wrong answer to export");
  const [width, height] = resultSizes[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  await document.fonts?.ready;
  const palette = inks["wrong-answers"];
  const [paper, ink, accent] = palette[result.skin] ?? palette[0];
  const wide = format === "wide";
  const square = format === "square";
  const story = format === "story";
  const margin = Math.round(Math.min(width, height) * .067);
  const safeTop = story ? Math.round(height * .13) : 0;
  const safeBottom = story ? Math.round(height * .17) : 0;
  const top = margin + safeTop;
  const footer = height - safeBottom - margin - 42;
  const inner = width - margin * 2;
  const contentBottom = footer - (wide ? 54 : 104);
  const mark = await picture("/brand/composer-icon-20261022b-96.png");

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, top, inner, 4);

  const stampTop = top + (wide ? 18 : 26);
  const stamp = drawWrongStamp(ctx, margin, stampTop, wide ? 14 : story ? 18 : 20, accent);
  const tabSize = wide ? 0 : square ? 58 : story ? 70 : 62;
  if (!wide && plate.number) {
    drawWrongTab(ctx, plate.number, width - margin - tabSize, stampTop, tabSize, paper, accent);
  }
  const metaSize = wide ? 13 : 19;
  const metaY = stampTop + stamp.height + (wide ? 30 : 42);
  const meta = plate.number
    ? `QUESTION ${String(plate.number).padStart(2, "0")} / ${wrongAnswerCount}${plate.tab ? ` · ${plate.tab.toUpperCase()}` : ""}`
    : "YOUR PROMPT";
  drawTracked(ctx, meta, margin, metaY, metaSize, accent);

  const labelSize = wide ? 13 : 19;
  const panelPadding = wide ? 24 : square ? 28 : story ? 42 : 36;

  if (wide) {
    const leftWidth = Math.round(inner * .44);
    const gutter = Math.round(inner * .04);
    const rightX = margin + leftWidth + gutter;
    const rightWidth = margin + inner - rightX;
    const promptY = metaY + 30;
    ctx.fillStyle = ink;
    drawPlateCentred(ctx, plate.prompt, margin, promptY, leftWidth, contentBottom - promptY, 58);
    ctx.save();
    ctx.globalAlpha = .32;
    ctx.fillStyle = ink;
    ctx.fillRect(margin + leftWidth + gutter / 2, stampTop, 2, contentBottom - stampTop);
    ctx.restore();

    const panelX = rightX;
    const panelY = stampTop;
    const panelW = rightWidth;
    const panelH = contentBottom - panelY;
    ctx.save();
    ctx.globalAlpha = .1;
    ctx.fillStyle = accent;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.restore();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(panelX + .75, panelY + .75, panelW - 1.5, panelH - 1.5);
    ctx.fillStyle = accent;
    ctx.fillRect(panelX, panelY, 7, panelH);
    drawTracked(ctx, "YOUR ANSWER", panelX + panelPadding, panelY + panelPadding + labelSize, labelSize, accent);
    const answerTop = panelY + panelPadding + labelSize + Math.round(labelSize * 1.1);
    ctx.fillStyle = ink;
    drawPlateText(
      ctx, plate.answer, panelX + panelPadding, answerTop,
      panelW - panelPadding * 2, contentBottom - panelPadding - answerTop, 34,
    );
  } else {
    const promptY = metaY + 34;
    const promptHeight = square ? 200 : story ? 360 : 302;
    ctx.fillStyle = ink;
    drawPlateCentred(ctx, plate.prompt, margin, promptY, inner, promptHeight, square ? 78 : story ? 96 : 92);

    const panelY = promptY + promptHeight + 26;
    const panelH = contentBottom - panelY;
    ctx.save();
    ctx.globalAlpha = .1;
    ctx.fillStyle = accent;
    ctx.fillRect(margin, panelY, inner, panelH);
    ctx.restore();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin + .75, panelY + .75, inner - 1.5, panelH - 1.5);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, panelY, 8, panelH);
    drawTracked(ctx, "YOUR ANSWER", margin + panelPadding, panelY + panelPadding + labelSize, labelSize, accent);
    const answerTop = panelY + panelPadding + labelSize + Math.round(labelSize * 1.1);
    ctx.fillStyle = ink;
    drawPlateText(
      ctx, plate.answer, margin + panelPadding, answerTop,
      inner - panelPadding * 2, contentBottom - panelPadding - answerTop,
      square ? 44 : story ? 62 : 60,
    );
  }

  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

/** One local tier-list PNG: the title, four named rows and their entries in
 * reading order, then the same publisher sign-off every card carries. Rows are
 * fixed, so the same board always draws the same text in the same position. */
async function renderTierList(result: ShareExperienceResult, format: ResultFormat): Promise<Blob> {
  const [width, height] = resultSizes[format];
  const wide = format === "wide";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  const palette = inks["tier-list"];
  const [paper, ink, accent] = palette[result.skin] ?? palette[0];
  const margin = Math.round(Math.min(width, height) * .067);
  const footer = height - margin - 42;
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, width - 2 * margin, 3);
  const header = wide ? 92 : Math.round(height * .15);
  ctx.fillStyle = ink;
  drawFit(ctx, result.title || tierListDefaultTitle, margin, margin + 12, width - 2 * margin, header - 12, wide ? 54 : 96);
  const rows = tierListRows(result.items, result.tierSizes);
  const gap = wide ? 5 : 8;
  const rowTop = margin + header + 10;
  const rowH = (footer - rowTop - 18 - gap * (tierListTierCount - 1)) / tierListTierCount;
  const labelW = Math.round((width - margin * 2) * (wide ? .2 : .27));
  const inset = wide ? 9 : 14;
  rows.forEach((entries, index) => {
    const y = rowTop + index * (rowH + gap);
    ctx.fillStyle = ink;
    ctx.fillRect(margin, y, labelW, rowH);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, y, 5, rowH);
    ctx.fillStyle = paper;
    const label = fitText(ctx, tierListTiers[index].label, labelW - inset * 2, rowH - inset * 2, wide ? 24 : 32);
    const labelH = label.lines.length * label.size * 1.14;
    label.lines.forEach((line, lineIndex) => {
      ctx.fillText(line, margin + inset, y + (rowH - labelH) / 2 + label.size + lineIndex * label.size * 1.14, labelW - inset * 2);
    });
    const x = margin + labelW + gap;
    const innerW = width - margin - x;
    ctx.save();
    ctx.globalAlpha = .07;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, innerW, rowH);
    ctx.restore();
    if (!entries.length) {
      ctx.save();
      ctx.globalAlpha = .55;
      ctx.fillStyle = ink;
      drawFit(ctx, "Empty row", x + inset, y + inset, innerW - inset * 2, rowH - inset * 2, wide ? 18 : 24, { weight: 500 });
      ctx.restore();
      return;
    }
    if (wide) {
      ctx.fillStyle = ink;
      drawFit(ctx, entries.join(" · "), x + inset, y + inset, innerW - inset * 2, rowH - inset * 2, 26, { weight: 600 });
      return;
    }
    const lineH = (rowH - inset * 2) / entries.length;
    entries.forEach((entry, entryIndex) => {
      const lineY = y + inset + entryIndex * lineH;
      ctx.fillStyle = accent;
      ctx.fillRect(x + inset, lineY + Math.min(lineH * .5, 16), 4, 4);
      ctx.fillStyle = ink;
      drawFit(ctx, entry, x + inset + 12, lineY, innerW - inset * 2 - 12, lineH, 30, { weight: 600 });
    });
  });
  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

/** One local Red Flag Court verdict card: the tabloid masthead, the current
 * case's exact wording, its docket number and the participant's red or green
 * call, plus the same publisher sign-off every card carries. Portrait stacks
 * the case above the stamped verdict; the wide card sets them side by side. */
async function renderRedFlagCourt(result: ShareExperienceResult, format: ResultFormat): Promise<Blob> {
  const card = redFlagCourtCard(result.courtCase, result.verdict);
  if (!card) throw new Error("No verdict to export");
  // Only the two promised sizes print; a crafted select value falls back to the
  // portrait rather than inventing another card shape.
  const layout: ResultFormat = format === "wide" ? "wide" : "portrait";
  const [width, height] = resultSizes[layout];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  await document.fonts?.ready;
  const palette = inks["red-flag-court"];
  const [paper, ink, accent] = palette[result.skin] ?? palette[0];
  const verdict = card.verdict === "red"
    ? { fill: "#a3151f", text: "#fff3df" }
    : { fill: "#146b3a", text: "#f7ffe9" };
  const wide = layout === "wide";
  const margin = Math.round(Math.min(width, height) * .06);
  const footer = height - margin - 42;
  const inner = width - margin * 2;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  // Masthead: a heavy accent rule, the docket name and this case's position.
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, inner, wide ? 8 : 12);
  const headY = margin + (wide ? 34 : 48);
  const metaSize = wide ? 14 : 18;
  drawTracked(ctx, redFlagCourtSubtitle.toUpperCase(), margin, headY, metaSize, ink, wide ? 2 : 3);
  const position = `CASE ${String(card.number).padStart(2, "0")} / ${redFlagCourtCount}`;
  drawTracked(ctx, position, margin + inner - trackedWidth(ctx, position, metaSize, wide ? 2 : 3), headY, metaSize, accent, wide ? 2 : 3);
  ctx.fillStyle = ink;
  ctx.fillRect(margin, headY + (wide ? 14 : 20), inner, 2);

  const contentTop = headY + (wide ? 50 : 74);
  const contentBottom = footer - (wide ? 48 : 96);

  if (wide) {
    const gutter = Math.round(inner * .05);
    const leftWidth = Math.round(inner * .5);
    const rightX = margin + leftWidth + gutter;
    const rightWidth = margin + inner - rightX;
    drawTracked(ctx, `THE CASE · ${card.tab.toUpperCase()}`, margin, contentTop + 14, 14, accent, 2);
    ctx.fillStyle = ink;
    drawFit(ctx, card.habit, margin, contentTop + 30, leftWidth, contentBottom - contentTop - 30, 52, {
      family: "Space, system-ui", weight: 800, lineHeight: 1.02,
    });
    const panelY = contentTop - 6;
    const panelH = contentBottom - panelY;
    ctx.fillStyle = verdict.fill;
    ctx.fillRect(rightX, panelY, rightWidth, panelH);
    ctx.strokeStyle = verdict.text;
    ctx.lineWidth = 3;
    ctx.strokeRect(rightX + 8.5, panelY + 8.5, rightWidth - 17, panelH - 17);
    drawTracked(ctx, "THE VERDICT", rightX + 26, panelY + 38, 14, verdict.text, 2);
    ctx.fillStyle = verdict.text;
    drawFit(ctx, card.verdictLabel.toUpperCase(), rightX + 26, panelY + 58, rightWidth - 52, panelH - 84, 96, {
      family: "Space, system-ui", weight: 800, lineHeight: .96,
    });
  } else {
    const verdictH = Math.round((contentBottom - contentTop) * .38);
    const verdictY = contentBottom - verdictH;
    drawTracked(ctx, `THE CASE · ${card.tab.toUpperCase()}`, margin, contentTop + 14, 18, accent, 3);
    ctx.fillStyle = ink;
    drawFit(ctx, card.habit, margin, contentTop + 38, inner, verdictY - contentTop - 74, 96, {
      family: "Space, system-ui", weight: 800, lineHeight: 1.03,
    });
    ctx.fillStyle = verdict.fill;
    ctx.fillRect(margin, verdictY, inner, verdictH);
    ctx.strokeStyle = verdict.text;
    ctx.lineWidth = 4;
    ctx.strokeRect(margin + 9, verdictY + 9, inner - 18, verdictH - 18);
    drawTracked(ctx, "THE VERDICT", margin + 30, verdictY + 44, 18, verdict.text, 3);
    ctx.fillStyle = verdict.text;
    drawFit(ctx, card.verdictLabel.toUpperCase(), margin + 30, verdictY + 64, inner - 60, verdictH - 92, 170, {
      family: "Space, system-ui", weight: 800, lineHeight: .95,
    });
  }

  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

/** One local Internet World Cup winner card. Both the faithful portrait and
 * the wide card print the exact champion and runner-up chosen by the seven
 * picks, each with its original paired name. The trophy is a crop of the owned
 * tech-tournament poster — no new artwork is introduced. */
async function renderTechTournament(result: ShareExperienceResult, format: ResultFormat): Promise<Blob> {
  const outcome = techTournamentOutcome(result.tournamentPicks);
  if (!outcome) throw new Error("No champion to export");
  // Only the two promised shapes print; a crafted select value falls back to
  // the portrait rather than inventing another card.
  const layout: ResultFormat = format === "wide" ? "wide" : "portrait";
  const [width, height] = resultSizes[layout];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  await document.fonts?.ready;
  const palette = inks["tech-tournament"];
  const [paper, ink, accent] = palette[result.skin] ?? palette[0];
  const wide = layout === "wide";
  const margin = Math.round(Math.min(width, height) * .06);
  const footer = height - margin - 42;
  const inner = width - margin * 2;
  const art = await picture(result.background);
  const cup = { x: art.width * .43, y: art.height * .07, width: art.width * .32, height: art.height * .82 };

  const drawCup = (x: number, y: number, w: number, h: number) => {
    const target = w / h;
    let sourceW = cup.width;
    let sourceH = cup.height;
    if (sourceW / sourceH > target) sourceW = sourceH * target;
    else sourceH = sourceW / target;
    const sourceX = cup.x + (cup.width - sourceW) / 2;
    const sourceY = cup.y + (cup.height - sourceH) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(art, sourceX, sourceY, sourceW, sourceH, x, y, w, h);
    ctx.restore();
  };

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, inner, wide ? 8 : 12);

  const headSize = wide ? 15 : 22;
  const headY = margin + (wide ? 32 : 48);
  const tracking = wide ? 2 : 3;
  drawTracked(ctx, "INTERNET WORLD CUP", margin, headY, headSize, ink, tracking);
  const picks = `${techTournamentPickCount} LOCAL PICKS`;
  drawTracked(ctx, picks, margin + inner - trackedWidth(ctx, picks, headSize, tracking), headY, headSize, accent, tracking);
  ctx.fillStyle = ink;
  ctx.fillRect(margin, headY + (wide ? 14 : 20), inner, 2);

  if (wide) {
    const panelY = margin + 68;
    const panelH = footer - panelY - 10;
    const panelW = Math.round(inner * .32);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, panelY, panelW, panelH);
    drawCup(margin + 12, panelY + 12, panelW - 24, panelH - 24);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(margin + 12.5, panelY + 12.5, panelW - 25, panelH - 25);

    const textX = margin + panelW + Math.round(inner * .055);
    const textW = margin + inner - textX;
    drawTracked(ctx, "YOUR CHAMPION", textX, panelY + 22, 16, accent, 2);
    ctx.fillStyle = ink;
    drawFit(ctx, outcome.winner.name, textX, panelY + 42, textW, 128, 126, {
      family: "Space, system-ui", weight: 800, lineHeight: .96,
    });
    drawFit(ctx, outcome.winner.pair, textX, panelY + 172, textW, 48, 36, { weight: 600 });
    ctx.fillStyle = accent;
    ctx.fillRect(textX, panelY + 230, textW, 4);
    drawTracked(ctx, "RUNNER-UP", textX, panelY + 266, 14, accent, 2);
    ctx.fillStyle = ink;
    drawFit(ctx, outcome.runnerUp.name, textX, panelY + 286, textW, 86, 72, {
      family: "Space, system-ui", weight: 800, lineHeight: .98,
    });
    drawFit(ctx, outcome.runnerUp.pair, textX, panelY + 374, textW, 40, 30, { weight: 600 });
  } else {
    const panelY = margin + 82;
    const panelH = Math.round((footer - panelY) * .38);
    const panelW = Math.round(inner * .68);
    const panelX = margin + Math.round((inner - panelW) / 2);
    ctx.fillStyle = accent;
    ctx.fillRect(panelX - 10, panelY + 10, panelW + 20, panelH);
    ctx.fillStyle = paper;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    drawCup(panelX + 16, panelY + 10, panelW - 32, panelH - 20);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX + .5, panelY + .5, panelW, panelH);

    const belowCup = panelY + panelH + 46;
    drawTracked(ctx, "YOUR CHAMPION", margin, belowCup, 22, accent, 3);
    ctx.fillStyle = ink;
    drawFit(ctx, outcome.winner.name, margin, belowCup + 26, inner, 156, 168, {
      family: "Space, system-ui", weight: 800, lineHeight: .94,
    });
    drawFit(ctx, outcome.winner.pair, margin, belowCup + 194, inner, 58, 44, { weight: 600 });
    ctx.fillStyle = accent;
    ctx.fillRect(margin, belowCup + 270, inner, 5);
    drawTracked(ctx, "RUNNER-UP", margin, belowCup + 314, 20, accent, 3);
    ctx.fillStyle = ink;
    drawFit(ctx, outcome.runnerUp.name, margin, belowCup + 340, inner, 96, 92, {
      family: "Space, system-ui", weight: 800, lineHeight: .98,
    });
    drawFit(ctx, outcome.runnerUp.pair, margin, belowCup + 446, inner, 46, 34, { weight: 600 });
  }

  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

export async function renderExperienceResult(
  result: ShareExperienceResult,
  format: ResultFormat,
  covers?: readonly (ResultCoverSlot | null)[],
) {
  // The tier board, one-must-go's shared grid, the wrong-answer plate, the
  // courtroom verdict card and the tournament winner card each keep their own
  // drawing; every other game keeps the established title-and-grid renderer
  // exactly as it was.
  if (result.game === "tier-list") return renderTierList(result, format);
  if (result.game === "wrong-answers") return renderWrongAnswers(result, format);
  if (result.game === "red-flag-court") return renderRedFlagCourt(result, format);
  if (result.game === "tech-tournament") return renderTechTournament(result, format);
  const [width, height] = resultSizes[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  const [paper, ink, accent] = inks[result.game][result.skin] ?? inks[result.game][0];
  const margin = Math.round(Math.min(width, height) * .067);
  const wide = format === "wide";
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  const footer = height - margin - 42;
  // A portrait Top Nine hangs a true square 3×3: the header cedes the frame's
  // extra height so each cell keeps its own width and square covers are not
  // cropped to fill 4:5. The square export and other games keep their sizes.
  const squareNine = format === "portrait" && result.game === "top-nine";
  const header = wide ? 120 : squareNine ? footer - width + margin - 30 : Math.round(height * .18);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, width - 2 * margin, 3);
  ctx.fillStyle = ink;
  // A Top Nine may carry one optional subtitle in the same header the title
  // already uses. The subtitle sits on the header's bottom edge and the title
  // keeps the room above it, so the grid start never moves and neither line is
  // clipped. Without a subtitle this is exactly the previous draw call.
  const subtitle = result.game === "top-nine" && result.items ? (result.subtitle ?? "").trim() : "";
  if (!subtitle) {
    drawFit(ctx, result.title, margin, margin + 12, width - 2 * margin, header - 12, wide ? 66 : 105);
  } else {
    const subtitleSize = wide ? 18 : 30;
    const subtitleLine = Math.round(subtitleSize * 1.22);
    ctx.font = `600 ${subtitleSize}px system-ui`;
    const lines = wrap(ctx, subtitle, width - 2 * margin);
    const block = lines.length * subtitleLine;
    const blockTop = margin + header - block;
    const gap = wide ? 4 : 10;
    drawFit(
      ctx, result.title, margin, margin + 12, width - 2 * margin,
      Math.max(blockTop - margin - 12 - gap, subtitleSize), wide ? 66 : 105,
    );
    ctx.save();
    ctx.globalAlpha = .82;
    ctx.textBaseline = "top";
    ctx.font = `600 ${subtitleSize}px system-ui`;
    lines.forEach((line, index) => ctx.fillText(line, margin, blockTop + index * subtitleLine, width - 2 * margin));
    ctx.restore();
  }
  if (result.items) {
    const cols = resultColumns(result.game, result.items.length);
    const rows = Math.ceil(result.items.length / cols);
    const rowY = margin + header + 12;
    const gap = wide ? 6 : 9;
    const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
    const cellH = (footer - rowY - (rows - 1) * gap - 18) / rows;
    // An explicitly ranked Top Nine numbers each occupied slot in every
    // format; an unordered board keeps exactly the previous drawing.
    const ranked = result.game === "top-nine" && result.ranked === true;
    const rankSize = Math.max(13, Math.min(30, Math.round(Math.min(cellW, cellH) * (wide ? .16 : .1))));
    const rankFor = (caption: string, index: number) => ranked && caption.trim() ? index + 1 : 0;
    result.items.forEach((caption, index) => {
      const x = margin + (index % cols) * (cellW + gap);
      const y = rowY + Math.floor(index / cols) * (cellH + gap);
      // Tech Bingo marks selected squares; one-must-go marks the one that left.
      // Both draw the same clear diagonal and never mark Bingo's free centre.
      const marked = (result.game === "tech-bingo" || result.game === "one-must-go")
        && Boolean(result.marked?.includes(index));
      const slot = result.game === "top-nine" ? covers?.[index] : undefined;
      const cover = slot?.art;
      const inset = wide ? 9 : 15;
      const rank = rankFor(caption, index);
      ctx.fillStyle = marked ? accent : ink;
      ctx.fillRect(x, y, cellW, cellH);
      if (!cover) {
        ctx.fillStyle = paper;
        let top = y + inset;
        let room = cellH - inset * 2;
        if (rank) {
          const used = drawRank(ctx, rank, x + inset, top, rankSize, paper, accent)
            + Math.max(6, Math.round(inset * .5));
          top += used;
          room -= used;
        }
        drawFit(ctx, caption || "—", x + inset, top, cellW - inset * 2, Math.max(room, rankSize), wide ? 24 : cols === 5 ? 28 : 43);
      } else if (wide) {
        // Landscape strips are shallow: contain the art in a matted square and
        // keep the readable title beside it.
        const mat = cellH;
        const scale = Math.min(mat / cover.width, mat / cover.height);
        const dw = cover.width * scale;
        const dh = cover.height * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cover, x + (mat - dw) / 2, y + (mat - dh) / 2, dw, dh);
        ctx.strokeStyle = paper;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + (mat - dw) / 2, y + (mat - dh) / 2, dw, dh);
        ctx.fillStyle = paper;
        let titleY = y + inset;
        let titleH = cellH - inset * 2;
        if (rank) {
          const used = drawRank(ctx, rank, x + mat + inset, titleY, rankSize, paper, accent)
            + Math.max(6, Math.round(inset * .5));
          titleY += used;
          titleH -= used;
        }
        drawFit(ctx, caption || "—", x + mat + inset, titleY, cellW - mat - inset * 2, Math.max(titleH, rankSize), 24);
      } else {
        // Square-ish cells hang the art by its chosen fit: cropped edge to
        // edge, or the whole artwork letterboxed on this cell's ink. Either
        // way the title stays readable on a scrim of that same ink.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellW, cellH);
        ctx.clip();
        const box = coverBox(cover.width, cover.height, cellW, cellH, slot?.fit ?? "cover");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cover, x + (cellW - box.width) / 2, y + (cellH - box.height) / 2, box.width, box.height);
        ctx.restore();
        const fit = fitText(ctx, caption || "—", cellW - inset * 2, cellH * .5, 43);
        const captionH = fit.lines.length * fit.size * 1.14;
        const bandTop = y + cellH - captionH - inset * 1.2;
        ctx.save();
        ctx.globalAlpha = .84;
        ctx.fillStyle = ink;
        ctx.fillRect(x, bandTop, cellW, y + cellH - bandTop);
        ctx.restore();
        ctx.fillStyle = paper;
        const first = y + cellH - inset - captionH;
        fit.lines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + inset, first + fit.size + lineIndex * fit.size * 1.14, cellW - inset * 2);
        });
        if (rank) drawRank(ctx, rank, x + inset, y + inset, rankSize, paper, accent);
      }
      if (marked && !(result.game === "tech-bingo" && index === 12)) {
        ctx.strokeStyle = paper;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 7, y + cellH - 8); ctx.lineTo(x + cellW - 8, y + 8); ctx.stroke();
      }
    });
  } else {
    const art = await picture(result.background);
    const panelY = margin + header;
    const panelH = footer - panelY - 24;
    const panelW = wide ? Math.floor(width * .35) : width - 2 * margin;
    const imageH = wide ? panelH : Math.round(panelH * .68);
    const scale = Math.min(panelW / art.width, imageH / art.height);
    ctx.drawImage(art, margin + (panelW - art.width * scale) / 2, panelY, art.width * scale, art.height * scale);
    const textX = wide ? margin * 2 + panelW : margin;
    const textY = wide ? panelY + 15 : panelY + imageH + 16;
    drawFit(ctx, result.subtitle ?? "", textX, textY, width - textX - margin, footer - textY - 10, wide ? 39 : 48);
  }
  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export image")), "image/png");
  });
}

/** A twenty-one-questions export: the answered pairs split across several
 * portrait 4:5 cards by default, a taller 9:16 Story canvas, or Square cards
 * carrying at most four pairs each so their type and white space stay measured.
 * Every format draws the same ordered, numbered groups; only the Story canvas
 * lifts content into the viewer's safe area. Answers arrive only in the
 * in-memory snapshot the caller already holds. */
export async function renderExperienceCards(result: ShareExperienceResult, format: "portrait" | "story" | "square" = "portrait"): Promise<Blob[]> {
  // All formats draw the same frozen prompt set the caller’s snapshot holds:
  // a malformed snapshot falls back to the built-in starter, never to a mix.
  const questions = Array.isArray(result.questions) && result.questions.length === twentyOneCount
    ? result.questions
    : twentyOneQuestions;
  const pairs = twentyOnePairs(result.items ?? [], questions);
  if (!pairs.length) throw new Error("No answers to export");
  // Square has less vertical room than 4:5, so it groups four ordered pairs
  // per card; portrait and Story keep their existing six-pair split.
  const cards = splitTwentyOneCards(pairs, format === "square" ? twentyOneSquareCardSize : twentyOneCardSize);
  const [width, height] = resultSizes[format];
  const margin = Math.round(Math.min(width, height) * .067);
  // A Story sits under the viewer's profile row and reply bar. Keep the print
  // width and the card split, but lift the whole layout inside those insets so
  // no heading, answer or sign-off is covered by Story chrome. Portrait has
  // both insets at zero, leaving every 4:5 coordinate exactly as it was.
  const safeTop = format === "story" ? Math.round(height * .13) : 0;
  const safeBottom = format === "story" ? Math.round(height * .17) : 0;
  const top = margin + safeTop;
  const footer = height - safeBottom - margin - 42;
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  const [paper, ink, accent] = inks[result.game][result.skin] ?? inks[result.game][0];
  const answered = twentyOneAnswered(result.items ?? []);
  const inner = width - margin * 2;
  const blobs: Blob[] = [];
  for (const [card, group] of cards.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image rendering is unavailable");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, top, inner, 3);
    ctx.fillStyle = ink;
    drawFit(ctx, result.title, margin, top + 14, inner, 96, 64);
    ctx.font = "600 24px system-ui";
    ctx.globalAlpha = .75;
    ctx.fillText(`${answered} of ${twentyOneCount} answered · card ${card + 1} of ${cards.length}`, margin, top + 132, inner);
    ctx.globalAlpha = 1;
    // Rows share the body evenly, so a short last card breathes and a full
    // card shrinks its longest answers to fit instead of clipping them.
    const rowsY = top + 158;
    const rowH = (footer - rowsY - 24) / group.length;
    group.forEach((pair, row) => {
      const y = rowsY + row * rowH;
      if (row) {
        ctx.save();
        ctx.globalAlpha = .3;
        ctx.fillStyle = ink;
        ctx.fillRect(margin, y - 10, inner, 2);
        ctx.restore();
      }
      ctx.fillStyle = accent;
      const ask = fitText(ctx, `${pair.index + 1}. ${pair.question}`, inner, rowH * .42, 30);
      ask.lines.forEach((line, lineIndex) => {
        ctx.fillText(line, margin, y + 12 + ask.size + lineIndex * ask.size * 1.14, inner);
      });
      const answerTop = y + 12 + ask.lines.length * ask.size * 1.14 + 8;
      ctx.fillStyle = ink;
      drawFit(ctx, pair.answer, margin, answerTop, inner, y + rowH - 14 - answerTop, 36);
    });
    signCard(ctx, mark, width, margin, footer, ink, result.byline);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not export image");
    blobs.push(blob);
  }
  return blobs;
}

/** The three formats the Developer Type result card offers. Wide is not one:
 * the outcome reads as a collectible specimen label, not a link preview. */
export const personaCardFormats = ["square", "portrait", "story"] as const;
export type PersonaCardFormat = (typeof personaCardFormats)[number];

/** The drawn bounds of one persona card. The same numbers position every
 * element and are exported so the focused tests can check that no format
 * puts type under Story chrome or outside the printed margin. */
export interface PersonaCardLayout {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly safeTop: number;
  readonly safeBottom: number;
  readonly contentTop: number;
  readonly contentBottom: number;
  readonly footer: number;
  readonly innerWidth: number;
  readonly labelSize: number;
  readonly displaySize: number;
  readonly serviceSize: number;
  readonly bodySize: number;
  readonly noteSize: number;
  readonly creditSize: number;
  /** The optional participant photo's circle in the label row. It is only
   * drawn when a valid local file was chosen, so its bounds never move an
   * existing element and a card without a photo keeps every old pixel. */
  readonly avatarSize: number;
  readonly avatarX: number;
  readonly avatarY: number;
}

export function personaCardLayout(format: PersonaCardFormat): PersonaCardLayout {
  const [width, height] = resultSizes[format];
  const margin = Math.round(Math.min(width, height) * .067);
  // Story sits under the viewer's profile row and reply bar, exactly like the
  // twenty-one-questions export. Square and portrait keep both insets at zero.
  const safeTop = format === "story" ? Math.round(height * .13) : 0;
  const safeBottom = format === "story" ? Math.round(height * .17) : 0;
  const footer = height - safeBottom - margin - 42;
  const contentTop = margin + safeTop;
  // Leave a quiet strip above the sign-off for the trademark credit.
  const contentBottom = footer - (format === "story" ? 92 : 78);
  const innerWidth = width - margin * 2;
  const story = format === "story";
  // The circle sits to the right of the tracked label, vertically centred on
  // that row and above the headline's first line, which starts 62px below the
  // rule. Right-aligning it keeps the same measured clearance in every format.
  const avatarSize = 56;
  return {
    width, height, margin, safeTop, safeBottom, contentTop, contentBottom, footer, innerWidth,
    labelSize: story ? 24 : 22,
    displaySize: story ? 150 : 132,
    serviceSize: story ? 62 : 56,
    bodySize: story ? 46 : 42,
    noteSize: story ? 30 : 28,
    creditSize: 16,
    avatarSize,
    avatarX: width - margin - avatarSize,
    avatarY: contentTop + 3,
  };
}

const personaFont = "Space, system-ui";

function personaBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  maxHeight: number,
  initial: number,
  weight: number,
  lineHeight: number,
) {
  const { size, lines } = fitText(ctx, text, width, maxHeight, initial, { family: personaFont, weight, lineHeight });
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + size + index * size * lineHeight, width);
  });
  return { size, lines, height: lines.length * size * lineHeight };
}

/** A small squared label tick followed by tracked capitals. Drawn rather than
 * set, so the label keeps its rhythm even where letter-spacing is unsupported. */
function personaLabel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string, accent: string, label: string) {
  ctx.save();
  ctx.fillStyle = accent;
  const tick = Math.round(size * .62);
  ctx.fillRect(x, y - tick, tick, tick);
  ctx.fillStyle = ink;
  ctx.font = `700 ${size}px ${personaFont}`;
  let cursor = x + tick + Math.round(size * .62);
  for (const character of label) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + Math.round(size * .2);
  }
  ctx.restore();
}

/** The service reads as a specimen tag: an outlined label, not a button or a
 * product badge. It shrinks to one line rather than clipping a long name. */
function personaServiceTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initial: number,
  accent: string,
) {
  let size = initial;
  ctx.save();
  do {
    ctx.font = `700 ${size}px ${personaFont}`;
    if (ctx.measureText(text).width + size * 1.3 <= maxWidth) break;
    size -= 2;
  } while (size > 20);
  const padX = Math.round(size * .55);
  const padY = Math.round(size * .3);
  const width = Math.min(maxWidth, Math.ceil(ctx.measureText(text).width) + padX * 2);
  const height = size + padY * 2;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + height / 2 + Math.round(size * .04));
  ctx.restore();
  return { width, height };
}

/** One downloadable persona result card for a trusted outcome. It takes only
 * the printable outcome copy, the chosen stage pair, the optional byline and
 * the optional participant photo, so the PNG cannot carry private run data, a
 * docs address or the quiz deep link. The returned Blob is what the preview and
 * Save link share. */
export async function renderPersonaCard(
  copy: PersonaCardPrint,
  format: PersonaCardFormat,
  options: {
    byline: string;
    skin: number;
    game: ExperienceId;
    label: string;
    credit: string;
    /** Decoded local pixels only. It arrives beside the printable copy, never
     * inside a result snapshot, so no link, caption, draft or JSON can carry it. */
    avatar?: HTMLCanvasElement | null;
  },
): Promise<Blob> {
  const layout = personaCardLayout(format);
  const { width, height } = layout;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  // Space is the page's own display face. Wait for it once so the canvas and
  // the live label share a voice; an unavailable face falls back to system-ui.
  await document.fonts?.ready;
  const palette = inks[options.game];
  const [paper, ink, accent] = palette[options.skin] ?? palette[0];
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(layout.margin, layout.contentTop, layout.innerWidth, 3);
  personaLabel(ctx, layout.margin, layout.contentTop + 40, layout.labelSize, ink, accent, options.label);

  const heroTop = layout.contentTop + 62;
  const room = layout.contentBottom - heroTop;
  ctx.fillStyle = ink;
  const hero = personaBlock(
    ctx, copy.archetype, layout.margin, heroTop, layout.innerWidth,
    Math.round(room * (format === "story" ? .3 : .34)),
    layout.displaySize, 700, 1.02,
  );

  const tagTop = heroTop + hero.height + Math.round(layout.displaySize * .24);
  const tag = personaServiceTag(ctx, copy.subject, layout.margin, tagTop, layout.innerWidth, layout.serviceSize, accent);

  const ruleY = tagTop + tag.height + 30;
  ctx.save();
  ctx.globalAlpha = .3;
  ctx.fillStyle = ink;
  ctx.fillRect(layout.margin, ruleY, layout.innerWidth, 2);
  ctx.restore();

  const tendencyTop = ruleY + 26;
  const tendencyMax = Math.round((layout.contentBottom - tendencyTop) * .46);
  ctx.fillStyle = ink;
  const tendency = personaBlock(
    ctx, copy.tendency, layout.margin, tendencyTop, layout.innerWidth, tendencyMax,
    layout.bodySize, 500, 1.28,
  );

  const noteTop = tendencyTop + tendency.height + 26;
  ctx.save();
  ctx.globalAlpha = .82;
  ctx.fillStyle = ink;
  personaBlock(ctx, copy.reason, layout.margin, noteTop, layout.innerWidth, layout.contentBottom - noteTop, layout.noteSize, 500, 1.4);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .68;
  ctx.fillStyle = ink;
  personaBlock(
    ctx, options.credit, layout.margin, layout.contentBottom + 8,
    layout.innerWidth, layout.footer - layout.contentBottom - 10, layout.creditSize, 500, 1.35,
  );
  ctx.restore();

  signCard(ctx, mark, width, layout.margin, layout.footer, ink, options.byline);
  if (options.avatar) {
    // The participant's own photo as a small centre-cropped circle. It is
    // drawn only after a valid local file was decoded, so a card without one
    // keeps the renderer's previous draw calls and exact PNG bytes.
    const size = layout.avatarSize;
    const box = coverBox(options.avatar.width, options.avatar.height, size, size, "cover");
    const centreX = layout.avatarX + size / 2;
    const centreY = layout.avatarY + size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centreX, centreY, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      options.avatar,
      layout.avatarX + (size - box.width) / 2,
      layout.avatarY + (size - box.height) / 2,
      box.width,
      box.height,
    );
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centreX, centreY, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}
