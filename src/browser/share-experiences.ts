import {
  agentBingo, developerBingo, doorEndings, experiencePath, experiences, internetBingo,
  thisOrThatPacks, twentyOnePacks, twentyOneQuestions, twentyOneResultTitle,
  type ExperienceId, type ThisOrThatPack, type TwentyOnePack,
} from "../lib/share-experiences.ts";
import {
  pickThisOrThat, restoreThisOrThatLength, restoreThisOrThatPack, restoreThisOrThatPicks,
  checkThisOrThatPhoto, cleanThisOrThatAlt, customThisOrThatOptionLimit, customThisOrThatPromptLimit,
  customThisOrThatTitle, freezeThisOrThatPhotos,
  moveThisOrThatCustom, readThisOrThatCustom, readThisOrThatComparisonOffer,
  readThisOrThatDraftFile, writeThisOrThatDraftFile,
  compareThisOrThatChoices,
  thisOrThatBlankLink, thisOrThatComplete, thisOrThatCount, thisOrThatDraftFileLimit,
  thisOrThatDraftFileName, thisOrThatDraftRowCount, thisOrThatPackFromQuery,
  thisOrThatProgress, thisOrThatStart, thisOrThatSummary, undoThisOrThat,
  type ThisOrThatComparison, type ThisOrThatDraftFileRead, type ThisOrThatLength,
  type ThisOrThatPromptPhoto, type ThisOrThatSide,
} from "../lib/this-or-that.ts";
import {
  moveTwentyOne, readTwentyOnePrompts, readTwentyOnePromptFile, setTwentyOneAnswer, skipTwentyOne,
  twentyOneAnswered, twentyOneAnswerLimit, twentyOneAnswersFileName, twentyOneAnswersText,
  twentyOneBlankLink, twentyOneCount, twentyOneDefaultPack, twentyOnePackForPrompts,
  twentyOnePackFromHash, twentyOnePairs, twentyOnePromptFileLimit, twentyOneShareFile,
  twentyOnePromptFileName, twentyOnePromptLimit, restoreTwentyOnePack,
  twentyOneStart, writeTwentyOnePromptFile,
  type TwentyOnePromptFileRead,
} from "../lib/twenty-one-questions.ts";
import { personaFor } from "../lib/persona-packs.ts";
import {
  personaCaption, personaCardAltText, personaDraftFileLimit, personaDraftFileName, readPersonaDraft,
  readPersonaDraftFile, writePersonaDraftFile,
  type PersonaDraft, type PersonaDraftFileRead, type PersonaDraftGap, type PersonaPack,
} from "../lib/persona-quiz.ts";
import {
  renderExperienceCards, renderExperienceResult, renderPersonaCard, resultSizes,
  type ResultCoverSlot, type ResultFormat, type ShareExperienceResult,
} from "./share-experience-image.ts";
import {
  cleanText, clearNineDraft, draftFileLimit, draftFileName, nineSubtitleLimit, readNineDraft,
  readNineDraftFile, writeNineDraft, writeNineDraftFile,
  type DraftStorage, type NineDraft, type NineDraftFileRead,
} from "../lib/share-experience-draft.ts";
import { profileUrl } from "../lib/top-nine-profile.ts";
import { topNineDate, topNineDateLabel } from "../lib/top-nine-date.ts";
import { nineListApplied, nineListSummary, planNineList, planNineListUndo } from "../lib/top-nine-list.ts";
import { normalisePageLinks, pageLink } from "../lib/top-nine-pages.ts";
import {
  appleBookRef, lookupAppleBook, searchBooks,
} from "../lib/top-nine-books.ts";
import {
  appleAppRef, lookupAppleApp, searchApps,
} from "../lib/top-nine-apps.ts";
import {
  musicPreview, musicSearchLinks, searchMusic,
  albumTitleApplies, appleAlbumRef, lookupAppleAlbum,
  appleSongRef, lookupAppleSong,
  lookupSpotifyAlbumTitle, lookupSpotifyTrackTitle, spotifyAlbumRef, spotifyTrackRef,
} from "../lib/top-nine-music.ts";
import {
  lookupWikidataTitle, searchWikidata, wikidataSource,
  type GamePlatformFilter, type WikidataPick,
} from "../lib/top-nine-wikidata.ts";
import {
  coverFileLimit, coverHeadLimit, coverPixelLimit, coverWorkingMax, sniffCover, type CoverFit,
} from "../lib/top-nine-cover.ts";
import {
  addTierListEntry, editTierListEntry, emptyTierListBoard, moveTierListEntry,
  moveTierListEntryWithinRow, removeTierListEntry, startTierListBoard, tierListCount, tierListDefaultTitle,
  tierListEntryLimit, tierListEntryTotal, tierListExampleTitle, tierListHasRoom,
  tierListRowEntryLimit, tierListSnapshot, tierListTiers,
  type TierListBoard,
} from "../lib/tier-list.ts";
import {
  oneMustGoBuiltinRounds, oneMustGoOutcome, oneMustGoRemainingLine,
  oneMustGoRoundFromQuery, oneMustGoRoundNote, oneMustGoRoundPath, oneMustGoStarter,
  oneMustGoTitle, readOneMustGoChoices,
  type OneMustGoBuiltinId, type OneMustGoRound,
} from "../lib/one-must-go.ts";
import {
  readWrongAnswerDraftFile, wrongAnswerCount, wrongAnswerDraftFileLimit, wrongAnswerDraftFileName,
  wrongAnswerLimit, wrongAnswerPlate, wrongAnswerPrintTitle, wrongAnswerPrompts, wrongAnswerStart,
  writeWrongAnswerDraftFile, type WrongAnswerDraftFileRead,
} from "../lib/wrong-answers.ts";
import {
  readRedFlagVerdict, redFlagCourtAltText, redFlagCourtCalled, redFlagCourtCase,
  redFlagCourtCases, redFlagCourtCount, redFlagCourtPrintTitle,
  type RedFlagVerdict,
} from "../lib/red-flag-court.ts";
import {
  cursedChoiceCount, cursedChoiceFromQuery, cursedChoiceInvitePath, cursedChoiceMade,
  cursedChoicePrompt, cursedChoiceStart, cursedChoices, cursedChoicesAltText,
  cursedChoicesPrintTitle, readCursedChoice, type CursedChoice,
} from "../lib/cursed-choices.ts";
import { topNineAltText } from "../lib/top-nine-alt-text.ts";
import { topNineCaption } from "../lib/top-nine-caption.ts";
import {
  oneMustGoAltText, techTournamentAltText, thisOrThatAltText, tierListAltText, wrongAnswersAltText,
} from "../lib/experience-alt-text.ts";
import {
  techTournamentComplete, techTournamentCurrent, techTournamentMatchLabel,
  techTournamentMatches, techTournamentOutcome, techTournamentParticipants,
  techTournamentPick, techTournamentPickCount, techTournamentPickCountMade,
  techTournamentPlaceholder, techTournamentStart, techTournamentTitle,
  techTournamentUndo, techTournamentWinner,
  type TechTournamentPick,
} from "../lib/tech-tournament.ts";
import {
  normaliseSourceLinks, sourceLink,
  type SourceKind, type SourceProvider,
} from "../lib/top-nine-source.ts";
import {
  replaceAttachmentList, replaceOfferApplies, replacePrompt, type ReplaceSlotSnapshot,
} from "../lib/top-nine-replace.ts";
import type { CataloguePick } from "../lib/itunes-catalogue.ts";

type SearchPick = CataloguePick | WikidataPick;

interface ResultSnapshot {
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Which This or That starter a shared link reopens; absent means maker. */
  pack?: ThisOrThatPack;
  /** Tier-list only: entries per row, summing to items. The board never
   * becomes a link, so this value stays in the tab. */
  tierSizes?: number[];
  /** Explicit ranked ordering. Absent keeps unordered favourites, so older
   * results and links restore exactly as they were. */
  ranked?: boolean;
  /** Canonical source links per exhibit; present only when at least one exists. */
  hrefs?: (string | null)[];
  /** Optional exact public web page per manually named exhibit. Interactive
   * board, draft and result link only: absent when empty, never part of an
   * export, and nothing here fetches or embeds it. */
  pages?: (string | null)[];
  /** One optional public HTTPS profile link. Interactive preview, draft and
   * result link only; absent when empty and never part of an export. */
  profile?: string;
  /** Top Nine only: one intentional calendar day beside the byline. Absent
   * keeps legacy results and undated exports exactly unchanged. */
  date?: string;
  /** The frozen authored prompts a private 21-questions card export draws. */
  questions?: string[];
  /** Wrong Answers Only: the exact question and private answer the downloaded
   * plate prints. Never serialised into a result link; the separate local draft
   * file preserves all ten raw answers only when the maker downloads it. */
  prompt?: string;
  answer?: string;
  /** Red Flag Court: the current docket position and the participant's call.
   * Held only in memory and never serialised into a result link. */
  courtCase?: number;
  verdict?: RedFlagVerdict;
  /** Internet World Cup: the seven ordered local picks the winner card draws.
   * Held only in memory; this bracket never becomes a result link or payload. */
  tournamentPicks?: (TechTournamentPick | null)[];
  /** Cursed Choices: the current docket position and the side picked for it.
   * Held only in memory; the card prints exactly these two and never becomes a
   * result link or payload. */
  cursePrompt?: number;
  curseChoice?: CursedChoice;
}

/** One cover a person picked from their device: session-only, never uploaded.
 * Its fit is chosen per cover and shares the slot's whole life — it moves with
 * a reorder, swap or undo, and a removed or replaced cover takes it along. */
interface CoverSlot {
  url: string;
  art: HTMLCanvasElement;
  kind: "png" | "jpeg" | "webp";
  fit: CoverFit;
}

interface Controller {
  result(): ResultSnapshot | null;
  restore(snapshot: Record<string, unknown>): void;
  resumeDraft?(protectShared: boolean): void;
  /** Releases the markup-level pre-hydration guard on initial play controls,
   * once the pack, any shared result and every handler are in place. Only the
   * games that ship such guarded controls implement it. */
  activate?(): void;
  /** Decoded cover art for the downloaded image; never part of a shared result. */
  exportCovers?(): readonly (ResultCoverSlot | null)[] | null;
  /** Whether the current run may produce a result link at all. Absent means
   * yes; a written five never becomes one, so URL sharing stays off. */
  linksAllowed?(): boolean;
  /** Whether the shared result card export may run. Absent means yes; a local
   * persona remix never becomes the published quiz's result card. */
  exportAllowed?(): boolean;
  /** The trusted persona outcome a result card may print. Absent for every
   * other experience; the generic JSON result link is never used for it. */
  personaOutcome?(): string | null;
}

const entry = cleanText;
const blockedStorage: DraftStorage = {
  getItem: () => null,
  setItem() { throw new Error("Local storage is blocked"); },
  removeItem() { throw new Error("Local storage is blocked"); },
};
const positions = Array.from({ length: 5 }, (_, index) => index);
const bingoLines = [
  ...positions.map((row) => positions.map((col) => row * 5 + col)),
  ...positions.map((col) => positions.map((row) => row * 5 + col)),
  positions.map((index) => index * 6),
  positions.map((index) => 4 + index * 4),
];

function elements<T extends Element>(root: HTMLElement, selector: string) {
  return Array.from(root.querySelectorAll<T>(selector));
}

function mountDoor(root: HTMLElement, update: () => void): Controller {
  const doors = root.querySelector<HTMLElement>("[data-root-view]")!;
  const rooms = elements<HTMLElement>(root, "[data-room]");
  const result = root.querySelector<HTMLElement>("[data-result]")!;
  const title = result.querySelector<HTMLElement>("[data-reveal-title]")!;
  const copy = result.querySelector<HTMLElement>("[data-reveal-copy]")!;
  const restart = root.querySelector<HTMLButtonElement>("[data-restart]")!;
  let endings: readonly (readonly [string, string])[] = doorEndings;
  let current: ResultSnapshot | null = null;

  function show(panel: HTMLElement, focus = true) {
    for (const node of [doors, ...rooms, result]) node.hidden = panel !== node;
    restart.hidden = panel === doors;
    if (focus) panel.querySelector<HTMLElement>("h2, button")?.focus({ preventScroll: true });
  }

  function reveal(ending: ResultSnapshot, focus: boolean) {
    current = ending;
    title.textContent = ending.title;
    copy.textContent = ending.subtitle ?? "";
    show(result, focus);
    update();
  }

  elements<HTMLButtonElement>(root, "[data-door]").forEach((button, index) => {
    button.addEventListener("click", () => show(rooms[index]));
  });
  elements<HTMLButtonElement>(root, "[data-ending]").forEach((button) => {
    button.addEventListener("click", () => {
      const ending = endings[Number(button.dataset.ending)];
      if (ending) reveal({ title: ending[0], subtitle: ending[1] }, true);
    });
  });
  restart.addEventListener("click", () => {
    current = null;
    show(doors);
    update();
  });

  const editor = root.querySelector<HTMLTextAreaElement>("[data-custom]")!;
  const message = root.querySelector<HTMLElement>("[data-custom-status]")!;
  editor.value = doorEndings.map((ending) => ending.join(" | ")).join("\n");
  editor.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = editor.value.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split("|"));
    if (next.length !== 10 || next.some(([label, story]) => !entry(label, 72) || !entry(story, 240))) {
      message.textContent = "Enter ten lines, each with a title, a | and a short story.";
      return;
    }
    endings = next.map(([label, story]) => [entry(label, 72), entry(story, 240)]);
    current = null;
    show(doors, false);
    update();
    message.textContent = "Your endings are ready. Pick a door to try them.";
  });

  return {
    result: () => current,
    activate() {
      // Door, hidden ending and custom-submit controls ship disabled in markup
      // so a held first tap cannot land before this mount and any shared result
      // are in place. This is the one ordinary entry that releases them; room,
      // replay and reveal states keep their own independent hidden logic.
      for (const button of elements<HTMLButtonElement>(root, "[data-door], [data-ending]")) {
        button.disabled = false;
      }
      const submit = editor.form?.querySelector<HTMLButtonElement>("[type=submit]");
      if (submit) submit.disabled = false;
    },
    restore(snapshot) {
      const title = entry(snapshot.title, 72);
      const subtitle = entry(snapshot.subtitle, 240);
      if (title && subtitle) reveal({ title, subtitle }, false);
    },
  };
}

let nineBoardCount = 0;

function mountNine(
  root: HTMLElement,
  update: () => void,
  byline: HTMLInputElement,
  chooseSkin: HTMLSelectElement,
  pickSkin: () => void,
): Controller {
  const title = root.querySelector<HTMLInputElement>("[data-exhibition-title]")!;
  const subtitle = root.querySelector<HTMLInputElement>("[data-exhibition-subtitle]")!;
  const profile = root.querySelector<HTMLInputElement>("[data-profile]");
  const dateInput = root.querySelector<HTMLInputElement>("[data-nine-date]")!;
  const dateStatus = root.querySelector<HTMLElement>("[data-nine-date-status]");
  const profileStatus = root.querySelector<HTMLElement>("[data-profile-status]");
  const profileRow = root.querySelector<HTMLElement>("[data-nine-preview-profile]");
  const profileLink = root.querySelector<HTMLAnchorElement>("[data-nine-preview-profile-link]");
  const page = {
    panel: root.querySelector<HTMLDetailsElement>("[data-page-panel]")!,
    target: root.querySelector<HTMLSelectElement>("[data-page-target-choice]")!,
    form: root.querySelector<HTMLFormElement>("[data-page-form]")!,
    input: root.querySelector<HTMLInputElement>("[data-page-url]")!,
    status: root.querySelector<HTMLElement>("[data-page-status]")!,
    linked: root.querySelector<HTMLUListElement>("[data-page-linked]")!,
  };
  const objects = elements<HTMLInputElement>(root, "[data-object]");
  const exhibitionBoard = root.querySelector<HTMLElement>("[data-exhibition-objects]")!;
  const dragHandles = elements<HTMLElement>(root, "[data-drag-slot]");
  const order = root.querySelector<HTMLSelectElement>("[data-order-index]")!;
  const swapTarget = root.querySelector<HTMLSelectElement>("[data-swap-target]")!;
  const swapSlots = root.querySelector<HTMLButtonElement>("[data-swap-slots]")!;
  const undoMove = root.querySelector<HTMLButtonElement>("[data-undo-move]")!;
  const preset = root.querySelector<HTMLSelectElement>("[data-nine-preset]")!;
  const rankedBox = root.querySelector<HTMLInputElement>("[data-nine-ranked]")!;
  const rankMarks = elements<HTMLElement>(root, "[data-exhibit-rank]");
  const rankBadges = elements<HTMLElement>(root, "[data-nine-preview-rank]");
  const draftStatus = root.querySelector<HTMLElement>("[data-draft-status]")!;
  const saveDraft = root.querySelector<HTMLButtonElement>("[data-draft-save]")!;
  const openDraft = root.querySelector<HTMLButtonElement>("[data-draft-open]")!;
  const clearDraft = root.querySelector<HTMLButtonElement>("[data-draft-clear]")!;
  const saveDraftFile = root.querySelector<HTMLButtonElement>("[data-draft-file-save]")!;
  const openDraftFile = root.querySelector<HTMLInputElement>("[data-draft-file]")!;
  const draftFileStatus = root.querySelector<HTMLElement>("[data-draft-file-status]")!;
  const list = {
    panel: root.querySelector<HTMLDetailsElement>("[data-list-panel]")!,
    form: root.querySelector<HTMLFormElement>("[data-list-form]")!,
    text: root.querySelector<HTMLTextAreaElement>("[data-list-text]")!,
    fill: root.querySelector<HTMLButtonElement>("[data-list-fill]")!,
    undo: root.querySelector<HTMLButtonElement>("[data-list-undo]")!,
    status: root.querySelector<HTMLElement>("[data-list-status]")!,
  };
  const music = {
    panel: root.querySelector<HTMLDetailsElement>("[data-music-panel]")!,
    target: root.querySelector<HTMLSelectElement>("[data-music-target-choice]")!,
    kind: elements<HTMLButtonElement>(root, "[data-music-kind]"),
    platformField: root.querySelector<HTMLElement>("[data-music-platform]")!,
    platform: root.querySelector<HTMLSelectElement>("[data-music-game-platform]")!,
    gameCoverage: root.querySelector<HTMLElement>("[data-music-game-coverage]")!,
    country: root.querySelector<HTMLSelectElement>("[data-music-country]")!,
    form: root.querySelector<HTMLFormElement>("[data-music-form]")!,
    query: root.querySelector<HTMLInputElement>("[data-music-query]")!,
    submit: root.querySelector<HTMLButtonElement>("[data-music-submit]")!,
    status: root.querySelector<HTMLElement>("[data-music-status]")!,
    results: root.querySelector<HTMLUListElement>("[data-music-results]")!,
    more: root.querySelector<HTMLButtonElement>("[data-music-more]")!,
    recovery: root.querySelector<HTMLElement>("[data-music-recovery]")!,
    recoveryNote: root.querySelector<HTMLElement>("[data-music-recovery-note]")!,
    recoveryApple: root.querySelector<HTMLAnchorElement>("[data-music-recovery-apple]")!,
    recoverySpotify: root.querySelector<HTMLAnchorElement>("[data-music-recovery-spotify]")!,
    recoveryWikidata: root.querySelector<HTMLAnchorElement>("[data-music-recovery-wikidata]")!,
    recoveryAlbums: root.querySelector<HTMLButtonElement>("[data-music-recovery-wikidata-albums]")!,
    recoveryBooks: root.querySelector<HTMLButtonElement>("[data-music-recovery-wikidata-books]")!,
    storefront: root.querySelector<HTMLElement>("[data-music-storefront]")!,
    coverage: root.querySelector<HTMLElement>("[data-music-coverage]")!,
    pasteForm: root.querySelector<HTMLFormElement>("[data-music-paste-form]")!,
    paste: root.querySelector<HTMLInputElement>("[data-music-paste]")!,
    linked: root.querySelector<HTMLUListElement>("[data-music-linked]")!,
    preview: root.querySelector<HTMLElement>("[data-music-preview]")!,
    previewTitle: root.querySelector<HTMLElement>("[data-music-preview-title]")!,
    previewFrame: root.querySelector<HTMLElement>("[data-music-preview-frame]")!,
    previewClose: root.querySelector<HTMLButtonElement>("[data-music-preview-close]")!,
    previewSource: root.querySelector<HTMLAnchorElement>("[data-music-preview-source]")!,
  };
  const cover = {
    panel: root.querySelector<HTMLDetailsElement>("[data-cover-panel]")!,
    target: root.querySelector<HTMLSelectElement>("[data-cover-target-choice]")!,
    file: root.querySelector<HTMLInputElement>("[data-cover-file]")!,
    status: root.querySelector<HTMLElement>("[data-cover-status]")!,
    linked: root.querySelector<HTMLUListElement>("[data-cover-linked]")!,
  };
  const previewGrid = root.querySelector<HTMLElement>("[data-nine-preview]");
  const previewCount = root.querySelector<HTMLElement>("[data-nine-count]");
  const previewTitle = root.querySelector<HTMLElement>("[data-nine-preview-title]");
  const previewSubtitle = root.querySelector<HTMLElement>("[data-nine-preview-subtitle]");
  const previewDate = root.querySelector<HTMLElement>("[data-nine-preview-date]");
  const previewDateValue = root.querySelector<HTMLTimeElement>("[data-nine-preview-date-value]");
  const previewCells = elements<HTMLElement>(root, "[data-nine-preview-cell]");
  const replace = {
    group: root.querySelector<HTMLElement>("[data-music-replace]")!,
    note: root.querySelector<HTMLElement>("[data-music-replace-note]")!,
    confirm: root.querySelector<HTMLButtonElement>("[data-music-replace-confirm]")!,
    keep: root.querySelector<HTMLButtonElement>("[data-music-replace-keep]")!,
  };
  const storage: DraftStorage = (() => {
    try { return localStorage; } catch { return blockedStorage; }
  })();
  let hrefs: (string | null)[] = objects.map(() => null);
  /** Exact public pages for manually named exhibits, each remembered with the
   * title it was attached to so a retitled exhibit never keeps a stale link. */
  let pageLinks: (string | null)[] = objects.map(() => null);
  let pageTitles: string[] = objects.map(() => "");
  let covers: (CoverSlot | null)[] = objects.map(() => null);
  let target = 0;
  let coverTarget = 0;
  let coverRun = 0;
  let kind: SourceKind = "album";
  let searching: AbortController | null = null;
  let searchRun = 0;
  /** True while the shown results came from the explicit Wikidata-album fallback. */
  let albumWikiSearch = false;
  /** Everything the current search returned, and how much of it is on screen. */
  let resultPicks: SearchPick[] = [];
  let shownResults = 0;
  let previewIndex: number | null = null;
  let previewFromSearch = false;
  let previewOpener: HTMLElement | null = null;
  /** One local undo for the most recent move, cleared when a draft or result replaces the exhibits. */
  let lastMove: { from: number; to: number } | null = null;
  /** A drop is honoured only while a drag from this board's own heading is
   * live. Nothing in the drag payload is read: the private type just keeps
   * foreign links, text and files out of the editor's state. */
  const dragType = "application/x-app-composer-top-nine-slot";
  const boardDragId = `top-nine-${++nineBoardCount}`;
  let activeDrag: { from: number; board: string } | null = null;
  /** The slots and exact title/page/music triples one pasted fill added, kept
   * whole so Undo clears that fill in one step and returns its raw rows. */
  let lastFill: { indexes: number[]; titles: string[]; urls: (string | null)[]; sources: (string | null)[]; rows: string[] } | null = null;
  /** One catalogue replacement waiting for the person's decision, bound to the
   * exact slot state the prompt named. A target change, new search, draft,
   * restore or any change to that slot clears it before it can apply. */
  let replaceOffer: (ReplaceSlotSnapshot & {
    pick: SearchPick;
    source: { href: string; provider: SourceProvider };
    label: string;
    button: HTMLButtonElement | null;
  }) | null = null;
  /** Album lookups still in flight for a pasted link, one per exhibit. */
  const pendingLookups = new Map<number, AbortController>();

  const note = (text: string) => { music.status.textContent = text; };
  const coverNote = (text: string) => { cover.status.textContent = text; };
  const firstEmpty = () => objects.findIndex((input) => !input.value.trim());
  const storeName = () => music.country.selectedOptions[0]?.textContent?.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()
    || music.country.value;
  const yearOf = (value: unknown) => Number.isInteger(value) && Number(value) > 1900 && Number(value) < 3000 ? String(value) : "";
  const kindLabel = { png: "PNG", jpeg: "JPEG", webp: "WebP" } as const;

  /** Manual recovery beside the results: ordinary links, no fetch and no new service.
   * For album and book queries only, one explicit action searches Wikidata for
   * the exact current term through the same two-call adapter; those results stay
   * release details — playback comes only from an Apple Music or Spotify link,
   * and a book pick links its Wikidata item and verified ISBN, never a cover. */
  function showRecovery(query: string, country: string, wiki: boolean, albumAction = false, bookAction = false) {
    for (const anchor of [music.recoveryApple, music.recoverySpotify, music.recoveryWikidata]) {
      anchor.hidden = true;
      anchor.removeAttribute("href");
    }
    music.recoveryAlbums.hidden = !albumAction;
    music.recoveryBooks.hidden = !bookAction;
    if (wiki) {
      music.recoveryWikidata.href =
        `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(query.toWellFormed())}`;
      music.recoveryWikidata.hidden = false;
      music.recoveryNote.textContent =
        "Wrong match? Search Wikidata, open the exact film, TV series, game or programming language, copy its link and paste it below.";
    } else if (bookAction) {
      music.recoveryNote.textContent =
        "Wrong match? Search Wikidata books: each result links its item page and shows an ISBN when one is verified. Apple Books stays the default search.";
    } else {
      const links = musicSearchLinks(query, country);
      music.recoveryApple.href = links.apple;
      music.recoverySpotify.href = links.spotify;
      music.recoveryApple.hidden = false;
      music.recoverySpotify.hidden = false;
      music.recoveryNote.textContent = albumAction
        ? "Wrong match? Search Apple Music or Spotify, select the exact album or song, copy its link and paste it below. Or search Wikidata albums: they list release details only — an Apple Music or Spotify link adds playback."
        : "Wrong match? Search Apple Music or Spotify, select the exact album or song, copy its link and paste it below.";
    }
    music.recovery.hidden = false;
  }
  function hideRecovery() {
    music.recovery.hidden = true;
    music.recoveryAlbums.hidden = true;
    music.recoveryBooks.hidden = true;
    for (const anchor of [music.recoveryApple, music.recoverySpotify, music.recoveryWikidata]) {
      anchor.hidden = true;
      anchor.removeAttribute("href");
    }
  }

  /** Canonical links for nine exhibits, and never for an exhibit with no title. */
  function trimHrefs(value: unknown) {
    const canonical = normaliseSourceLinks(value);
    return objects.map((input, index) => {
      const href = canonical[index] ?? null;
      return href && input.value.trim() ? href : null;
    });
  }

  /** Exact pages for the current board: positional like source links, and
   * only for an exhibit whose title still matches the attached page. */
  function trimPages(value: unknown) {
    const restored = normalisePageLinks(value);
    return objects.map((input, index) => (input.value.trim() ? restored[index] ?? null : null));
  }

  function markTarget() {
    music.target.value = String(target);
    objects.forEach((input, index) => {
      const active = music.panel.open && index === target;
      input.closest("label")?.toggleAttribute("data-music-target", active);
      const marker = root.querySelector<HTMLElement>(`[data-exhibit-filling="${index}"]`);
      if (marker) marker.hidden = !active;
    });
  }

  /** The page form marks its own target, so it stays independent of the
   * provider search's Fill exhibit choice. */
  function markPageTarget() {
    const slot = Number(page.target.value);
    objects.forEach((input, index) => {
      input.closest("label")?.toggleAttribute("data-page-target", page.panel.open && index === slot);
    });
  }

  function renderLinked() {
    music.linked.replaceChildren();
    hrefs.forEach((href, index) => {
      const source = sourceLink(href);
      if (!source) return;
      const name = entry(objects[index].value, 40) || "untitled";
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `Exhibit ${index + 1} · ${name} · ${source.provider}`;
      const openIn = source.provider === "Apple Books" ? "Open in Apple Books"
        : source.provider === "App Store" ? "Open in the App Store"
        : source.provider === "Wikidata" ? "Open on Wikidata" : null;
      const open: HTMLAnchorElement | HTMLButtonElement =
        openIn ? document.createElement("a") : document.createElement("button");
      open.className = openIn ? "button secondary" : "secondary";
      if (openIn) {
        (open as HTMLAnchorElement).href = source.href;
        (open as HTMLAnchorElement).target = "_blank";
        (open as HTMLAnchorElement).rel = "noopener noreferrer nofollow";
        open.textContent = openIn;
        open.setAttribute("aria-label", `Open the ${source.provider} link for exhibit ${index + 1} in a new tab`);
      } else {
        (open as HTMLButtonElement).type = "button";
        open.textContent = "Preview";
        open.addEventListener("click", () => openPreview(index));
        open.setAttribute("aria-label", `Preview the ${source.provider} link for exhibit ${index + 1}`);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove link";
      remove.setAttribute("aria-label", `Remove the ${source.provider} link from exhibit ${index + 1}`);
      remove.addEventListener("click", () => {
        setLink(index, null);
        note(`Exhibit ${index + 1} keeps its title. The source link was removed.`);
        update();
        music.panel.querySelector("summary")?.focus({ preventScroll: true });
      });
      row.append(label, open, remove);
      music.linked.append(row);
    });
    music.linked.hidden = !music.linked.childElementCount;
  }

  function refreshLinks() {
    if (prunePages()) renderPreview();
    hrefs.forEach((href, index) => {
      const source = sourceLink(href);
      objects[index].closest("label")?.toggleAttribute("data-has-link", Boolean(source));
      const state = root.querySelector<HTMLElement>(`[data-music-slot-state="${index}"]`);
      if (!state) return;
      state.hidden = !source;
      state.textContent = source ? `${source.provider} link` : "";
    });
    renderLinked();
    renderPages();
    if (list.panel.open) showListCount();
  }

  function setLink(index: number, href: string | null) {
    if (hrefs[index] !== href) {
      cancelLookup(index);
      // A source link changed under an open replacement prompt: the prompt no
      // longer describes this slot, so it closes before the write lands.
      if (replaceOffer?.slot === index) clearReplace();
    }
    hrefs[index] = href;
    if (previewIndex === index) closePreview(false);
    refreshLinks();
  }

  /** Stop a pending pasted-link lookup for one exhibit, or every exhibit. */
  function cancelLookup(index?: number) {
    if (index === undefined) {
      for (const controller of pendingLookups.values()) controller.abort();
      pendingLookups.clear();
      return;
    }
    pendingLookups.get(index)?.abort();
    pendingLookups.delete(index);
  }

  /** Release one exhibit's cover: revoke its object URL and drop its pixels. */
  function disposeCover(index: number) {
    const slot = covers[index];
    if (!slot) return;
    URL.revokeObjectURL(slot.url);
    covers[index] = null;
  }

  function markCoverTarget() {
    cover.target.value = String(coverTarget);
    objects.forEach((input, index) => {
      input.closest("label")?.toggleAttribute("data-cover-target", cover.panel.open && index === coverTarget);
    });
  }

  function renderCovers() {
    covers.forEach((slot, index) => {
      const state = root.querySelector<HTMLElement>(`[data-cover-slot-state="${index}"]`);
      if (!state) return;
      state.hidden = !slot;
      state.textContent = slot ? `${kindLabel[slot.kind]} cover` : "";
    });
    cover.linked.replaceChildren();
    covers.forEach((slot, index) => {
      if (!slot) return;
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `Exhibit ${index + 1} · ${kindLabel[slot.kind]}`;
      // The one labelled, compact fit choice for this cover. It edits the
      // slot in place, so the preview and every export follow at once.
      const fitField = document.createElement("label");
      fitField.className = "cover-fit";
      const fitChoice = document.createElement("select");
      fitChoice.setAttribute("aria-label", `Fit for exhibit ${index + 1}`);
      const fill = document.createElement("option");
      fill.value = "cover";
      fill.textContent = "Fill cell";
      const whole = document.createElement("option");
      whole.value = "contain";
      whole.textContent = "Show whole cover";
      fitChoice.append(fill, whole);
      fitChoice.value = slot.fit;
      fitChoice.addEventListener("change", () => {
        const current = covers[index];
        // A removal rebuilds this list, so a late change on the dropped row
        // never writes a fit onto a slot that no longer exists.
        if (!current) return;
        current.fit = fitChoice.value === "contain" ? "contain" : "cover";
        renderPreview();
        coverNote(`Exhibit ${index + 1} ${current.fit === "contain"
          ? "shows its whole cover, letterboxed on the cell"
          : "fills its cell with the cover"}.`);
      });
      fitField.append("Fit", fitChoice);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove cover";
      remove.setAttribute("aria-label", `Remove the cover from exhibit ${index + 1}`);
      remove.addEventListener("click", () => {
        if (replaceOffer?.slot === index) clearReplace();
        disposeCover(index);
        renderCovers();
        renderPreview();
        coverNote(`Cover removed from exhibit ${index + 1}. Its title stays.`);
        cover.panel.querySelector("summary")?.focus({ preventScroll: true });
      });
      row.append(label, fitField, remove);
      cover.linked.append(row);
    });
    cover.linked.hidden = !cover.linked.childElementCount;
    if (list.panel.open) showListCount();
  }

  /** The optional profile link beside the preview: only a validated HTTPS
   * address becomes clickable. Nothing is fetched or embedded, and clearing or
   * invalidating the field removes the link rather than leaving a stale one. */
  function renderProfile() {
    if (!profileRow || !profileLink) return;
    const raw = profile?.value.trim() ?? "";
    const href = profileUrl(raw);
    const invalid = Boolean(raw && !href);
    if (invalid) profile?.setAttribute("aria-invalid", "true");
    else profile?.removeAttribute("aria-invalid");
    const message = invalid ? "Use a full public profile link beginning with https://." : "";
    if (profileStatus && profileStatus.textContent !== message) profileStatus.textContent = message;
    if (href) {
      profileLink.href = href;
      profileLink.textContent = href;
      profileRow.hidden = false;
      return;
    }
    profileRow.hidden = true;
    profileLink.removeAttribute("href");
    profileLink.textContent = "";
  }

  /** The optional date is a calendar day, never today's date or an instant.
   * Invalid native input is explained beside the field and omitted everywhere
   * else; the preview uses the same fixed readable label as the PNG. */
  function renderDate() {
    const value = topNineDate(dateInput.value);
    const invalid = dateInput.validity?.badInput === true || Boolean(dateInput.value && !value);
    if (invalid) dateInput.setAttribute("aria-invalid", "true");
    else dateInput.removeAttribute("aria-invalid");
    const message = invalid
      ? "Use a real calendar date from 0001-01-01 to 9999-12-31, or leave it blank."
      : "";
    if (dateStatus && dateStatus.textContent !== message) dateStatus.textContent = message;
    if (!previewDate || !previewDateValue) return;
    const label = topNineDateLabel(value);
    previewDateValue.textContent = label;
    previewDate.hidden = !label;
    if (value) previewDateValue.dateTime = value;
    else previewDateValue.removeAttribute("datetime");
  }

  /** The exact page for one exhibit, only while its title is still the one the
   * page was attached to. An edit, a provider fill or an empty slot never
   * leaves an old address hanging from a different title. */
  function livePage(index: number) {
    const href = pageLinks[index];
    return href && pageTitles[index] === objects[index].value.trim() ? href : null;
  }

  /** Retire any page whose title changed without going through the page form,
   * such as a provider pick or a pasted source link filling the same slot. */
  function prunePages() {
    let changed = false;
    pageLinks.forEach((href, index) => {
      if (!href || pageTitles[index] === objects[index].value.trim()) return;
      pageLinks[index] = null;
      pageTitles[index] = "";
      changed = true;
    });
    return changed;
  }

  function pageHost(href: string) {
    try { return new URL(href).hostname.replace(/^www\./, "") || "web page"; } catch { return "web page"; }
  }

  /** The compact management list for exact pages: one outbound open and one
   * intentional remove per manually named exhibit. No fetch, embed or upload. */
  function renderPages() {
    objects.forEach((_, index) => {
      const state = root.querySelector<HTMLElement>(`[data-page-slot-state="${index}"]`);
      if (!state) return;
      const href = livePage(index);
      state.hidden = !href;
      state.textContent = href ? `Web page · ${pageHost(href)}` : "";
    });
    page.linked.replaceChildren();
    pageLinks.forEach((_, index) => {
      const href = livePage(index);
      if (!href) return;
      const name = entry(objects[index].value, 40) || "untitled";
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `Exhibit ${index + 1} · ${name} · ${pageHost(href)}`;
      const open = document.createElement("a");
      open.className = "button secondary";
      open.href = href;
      open.target = "_blank";
      open.rel = "noopener noreferrer ugc";
      open.textContent = "Open page";
      open.setAttribute("aria-label", `Open the web page for exhibit ${index + 1} in a new tab`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove page";
      remove.setAttribute("aria-label", `Remove the web page link from exhibit ${index + 1}`);
      remove.addEventListener("click", () => {
        if (replaceOffer?.slot === index) clearReplace();
        pageLinks[index] = null;
        pageTitles[index] = "";
        page.status.textContent = `Exhibit ${index + 1} keeps its title. Its web page link was removed.`;
        renderPages();
        renderPreview();
        update();
        page.panel.querySelector("summary")?.focus({ preventScroll: true });
      });
      row.append(label, open, remove);
      page.linked.append(row);
    });
    page.linked.hidden = !page.linked.childElementCount;
  }

  /** The in-page grid mirrors what the downloaded image will hang: cover first,
   * title on top, in the exhibition's own cell colours. An explicitly ranked
   * board also numbers every occupied slot here, exactly as the export does. */
  function renderPreview() {
    if (previewTitle) previewTitle.textContent = entry(title.value, 72) || "Untitled board";
    const ranked = rankedBox.checked;
    const line = entry(subtitle.value, nineSubtitleLimit);
    if (previewSubtitle) {
      previewSubtitle.textContent = line;
      previewSubtitle.hidden = !line;
    }
    if (previewCount) {
      previewCount.textContent = `${objects.filter((input) => entry(input.value, 54)).length} of 9 titles`;
    }
    previewCells.forEach((cell, index) => {
      const slot = covers[index];
      const showRank = ranked && Boolean(objects[index].value.trim());
      const image = cell.querySelector<HTMLImageElement>("[data-nine-preview-cover]")!;
      const caption = cell.querySelector<HTMLAnchorElement>("[data-nine-preview-caption]")!;
      const label = objects[index].value.trim() || "—";
      caption.textContent = label;
      // A manually attached page makes the board title itself an ordinary
      // outbound link. No page means no href, so the caption stays plain text.
      const pageHref = livePage(index);
      if (pageHref) {
        caption.href = pageHref;
        caption.target = "_blank";
        caption.rel = "noopener noreferrer ugc";
        caption.title = pageHref;
        caption.setAttribute("aria-label",
          `${objects[index].value.trim() || `Exhibit ${index + 1}`} — open its web page in a new tab`);
      } else {
        caption.removeAttribute("href");
        caption.removeAttribute("target");
        caption.removeAttribute("rel");
        caption.removeAttribute("title");
        caption.removeAttribute("aria-label");
      }
      const badge = rankBadges[index];
      if (badge) badge.hidden = !showRank;
      const mark = rankMarks[index];
      if (mark) {
        mark.hidden = !showRank;
        if (showRank) objects[index].setAttribute("aria-describedby", mark.id);
        else objects[index].removeAttribute("aria-describedby");
      }
      cell.toggleAttribute("data-ranked", showRank);
      cell.toggleAttribute("data-covered", Boolean(slot));
      // The in-page cell hangs the art by the same fit the export will: the
      // attribute is absent without art, so an empty cell never keeps one.
      if (slot) cell.setAttribute("data-cover-fit", slot.fit);
      else cell.removeAttribute("data-cover-fit");
      if (!slot) {
        image.hidden = true;
        image.removeAttribute("src");
        return;
      }
      if (image.getAttribute("src") !== slot.url) image.src = slot.url;
      image.hidden = false;
    });
    renderProfile();
    renderDate();
  }

  /** One device image onto one exhibit: bounded, decoded locally, never uploaded. */
  async function hangCover(file: File) {
    const index = coverTarget;
    const run = ++coverRun;
    const fail = (text: string) => { if (run === coverRun) coverNote(text); };
    if (file.size > coverFileLimit) {
      fail(`That image is ${Math.round(file.size / 1_048_576)} MB. Covers can be up to ${coverFileLimit / 1_048_576} MB.`);
      return;
    }
    const head = new Uint8Array(await file.slice(0, coverHeadLimit).arrayBuffer());
    if (run !== coverRun) return;
    const sniffed = sniffCover(head);
    if (!sniffed) {
      fail("That file isn’t a readable PNG, JPEG or WebP image. Pick a photo or artwork from your device.");
      return;
    }
    if (sniffed.width * sniffed.height > coverPixelLimit) {
      fail(`That image is ${sniffed.width.toLocaleString()} × ${sniffed.height.toLocaleString()} pixels. Covers can be up to ${coverPixelLimit / 1_000_000} megapixels.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const source = new Image();
    source.src = url;
    try {
      await source.decode();
    } catch {
      URL.revokeObjectURL(url);
      fail("That image couldn’t be decoded. Export it as PNG or JPEG, then pick it again.");
      return;
    }
    if (run !== coverRun) {
      URL.revokeObjectURL(url);
      return;
    }
    if (source.naturalWidth * source.naturalHeight > coverPixelLimit) {
      URL.revokeObjectURL(url);
      fail("That image is too large to hang here. Try a smaller copy.");
      return;
    }
    const scale = Math.min(1, coverWorkingMax / Math.max(source.naturalWidth, source.naturalHeight));
    const art = document.createElement("canvas");
    art.width = Math.max(1, Math.round(source.naturalWidth * scale));
    art.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const artCtx = art.getContext("2d");
    if (!artCtx) {
      URL.revokeObjectURL(url);
      fail("This browser couldn’t prepare that cover. Try a smaller image.");
      return;
    }
    artCtx.imageSmoothingQuality = "high";
    artCtx.drawImage(source, 0, 0, art.width, art.height);
    if (replaceOffer?.slot === index) clearReplace();
    disposeCover(index);
    // A fresh cover starts at the current cropped default; any fit chosen for
    // the art it replaces went with that slot.
    covers[index] = { url, art, kind: sniffed.kind, fit: "cover" };
    renderCovers();
    renderPreview();
    coverNote(`Cover added to exhibit ${index + 1}. It moves with the exhibit and appears in your downloaded image.`);
  }

  const previewHeight = { "Apple Music": "450", Spotify: "352" } as const;

  /** The one player frame both entry points share: replacing it stops the old
   * audio, and nothing remote loads until a person asks to preview. */
  function showPlayer(
    preview: NonNullable<ReturnType<typeof musicPreview>>,
    heading: string,
    frameTitle: string,
  ) {
    const frame = document.createElement("iframe");
    frame.src = preview.embedUrl;
    frame.title = frameTitle;
    frame.setAttribute("width", "100%");
    frame.height = previewHeight[preview.provider];
    frame.allow = "encrypted-media; fullscreen; picture-in-picture";
    frame.referrerPolicy = "no-referrer";
    music.previewFrame.replaceChildren(frame);
    music.previewTitle.textContent = heading;
    music.previewSource.textContent = `Open in ${preview.provider}`;
    music.previewSource.href = preview.href;
    music.preview.hidden = false;
    music.previewTitle.focus();
  }

  function openPreview(index: number) {
    const preview = musicPreview(hrefs[index]);
    if (!preview) {
      const provider = sourceLink(hrefs[index])?.provider;
      note(hrefs[index]
        ? `Exhibit ${index + 1} has a ${provider} source link. Open it there — it has no player here.`
        : `Exhibit ${index + 1} has no playable link.`);
      return;
    }
    previewIndex = index;
    previewFromSearch = false;
    previewOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showPlayer(
      preview,
      `${preview.provider} preview · exhibit ${index + 1}`,
      `${preview.provider} player for exhibit ${index + 1}: ${entry(objects[index].value, 54) || "untitled"}`,
    );
  }

  /** Audition one search hit without filling a slot or touching its link. */
  function openSearchPreview(pick: SearchPick) {
    const preview = musicPreview(pick.href);
    const name = entry(pick.title, 54);
    if (!preview || !name) return;
    previewIndex = null;
    previewFromSearch = true;
    previewOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const artist = entry(pick.artist, 48);
    showPlayer(
      preview,
      `${preview.provider} preview · ${name}`,
      `${preview.provider} player for ${name}${artist ? ` by ${artist}` : ""}`,
    );
    note(`Previewing ${name} on ${preview.provider}. Choose a result to add it to exhibit ${target + 1}.`);
  }

  /** One preview at a time: closing removes the frame so playback stops too. */
  function closePreview(restoreFocus = true) {
    previewIndex = null;
    previewFromSearch = false;
    music.previewFrame.replaceChildren();
    music.preview.hidden = true;
    music.previewSource.removeAttribute("href");
    if (restoreFocus && previewOpener?.isConnected) previewOpener.focus({ preventScroll: true });
    previewOpener = null;
  }

  /** Results that disappear take their player with them; a slot preview stays. */
  function closeSearchPreview() {
    if (previewFromSearch) closePreview(false);
  }

  const resultPage = 12;

  /** The status line counts what came back, not what fits on screen. */
  function resultNote() {
    const total = resultPicks.length;
    const shown = Math.min(shownResults, total);
    const counts = total === 1 ? "One result" : `${total} results`;
    return `${counts}${shown < total ? `. Showing the first ${shown}` : ""}. Choose one to fill exhibit ${target + 1}.`;
  }

  /** Rows append in pages, so a wider list keeps focus on Show more and leaves
   * an open inline preview alone instead of rebuilding what is already there. */
  function appendResultRows(picks: SearchPick[]): HTMLButtonElement | null {
    let firstChoice: HTMLButtonElement | null = null;
    for (const pick of picks) {
      const source = sourceLink(pick.href);
      const name = entry(pick.title, 80);
      if (!source || !name) continue;
      const artist = entry(pick.artist, 60);
      const year = yearOf(pick.year);
      const playable = musicPreview(pick.href);
      const article = "article" in pick && typeof pick.article === "string" ? pick.article : null;
      const platform = "platform" in pick && typeof pick.platform === "string" ? pick.platform : null;
      const isbn = "isbn" in pick && typeof pick.isbn === "string" ? entry(`ISBN ${pick.isbn}`, 30) : null;
      const row = document.createElement("li");
      if (article) row.className = "has-article";
      const button = document.createElement("button");
      button.type = "button";
      const heading = document.createElement("strong");
      heading.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = [artist, year, platform, isbn, source.provider].filter(Boolean).join(" · ")
        || `Unlisted · ${source.provider}`;
      button.append(heading, detail);
      button.addEventListener("click", () => fillFromPick(pick, button));
      row.append(button);
      if (!firstChoice) firstChoice = button;
      if (playable) {
        row.classList.add("has-preview");
        const preview = document.createElement("button");
        preview.type = "button";
        preview.className = "music-preview-open";
        preview.textContent = "Preview";
        preview.setAttribute("aria-label",
          `Preview ${name}${artist ? ` by ${artist}` : ""} on ${playable.provider} without filling a slot`);
        preview.addEventListener("click", () => openSearchPreview(pick));
        row.append(preview);
      }
      if (article) {
        const open = document.createElement("a");
        open.className = "music-article";
        open.href = article;
        open.target = "_blank";
        open.rel = "noopener noreferrer nofollow";
        open.textContent = "Article";
        open.setAttribute("aria-label", `Open the English Wikipedia article about ${name} in a new tab`);
        row.append(open);
      }
      music.results.append(row);
    }
    return firstChoice;
  }

  /** Show the next page of the same response; never refetch or re-render.
   * An explicit reveal focuses the first new choice; the initial render passes
   * no flag so it never scrolls away from the search. */
  function revealResults(reveal = false) {
    const next = resultPicks.slice(shownResults, shownResults + resultPage);
    shownResults += next.length;
    const firstChoice = appendResultRows(next);
    const remaining = shownResults < resultPicks.length;
    music.more.hidden = !remaining;
    music.results.hidden = !music.results.childElementCount;
    note(resultNote());
    if (reveal) firstChoice?.focus({ preventScroll: true });
  }

  function renderResults(picks: SearchPick[]) {
    resultPicks = picks;
    shownResults = 0;
    music.results.replaceChildren();
    revealResults();
  }

  function clearResults() {
    // A new search, typed query or kind change retires any pending replacement:
    // its result row is about to leave the panel.
    clearReplace();
    resultPicks = [];
    shownResults = 0;
    music.more.hidden = true;
    music.results.hidden = true;
    music.results.replaceChildren();
    closeSearchPreview();
  }

  /** Close the one pending replacement. When it held focus, or a caller asks,
   * focus returns to the pick that opened it, else the next usable catalogue
   * control — never a control that no longer exists. */
  function clearReplace(restoreFocus = false) {
    const offer = replaceOffer;
    if (!offer) return;
    const heldFocus = replace.group.contains(document.activeElement);
    replaceOffer = null;
    replace.group.hidden = true;
    replace.note.textContent = "";
    replace.confirm.textContent = "Replace exhibit";
    if (!restoreFocus && !heldFocus) return;
    const button = offer.button?.isConnected
      ? offer.button
      : music.results.querySelector<HTMLButtonElement>("li > button:not(.music-preview-open)");
    const fallback = button ?? music.panel.querySelector<HTMLElement>("summary") ?? music.query;
    fallback?.focus({ preventScroll: true });
  }

  /** One result onto an occupied or already attached exhibit: say which
   * exhibit, name both titles, plainly warn what is removed, and wait. */
  function offerReplace(
    slot: number,
    pick: SearchPick,
    source: { href: string; provider: SourceProvider },
    label: string,
    button: HTMLButtonElement | null,
  ) {
    // One decision at a time: a second result replaces the first prompt.
    if (replaceOffer) clearReplace();
    const attached = [
      hrefs[slot] ? `${sourceLink(hrefs[slot])?.provider ?? "Source"} source link` : "",
      livePage(slot) ? "web page" : "",
      covers[slot] ? "cover art" : "",
    ].filter(Boolean);
    replaceOffer = {
      slot, pick, source, label, button,
      title: objects[slot].value,
      href: hrefs[slot],
      page: livePage(slot),
      cover: covers[slot],
    };
    replace.confirm.textContent = `Replace exhibit ${slot + 1}`;
    replace.note.textContent = replacePrompt(slot, entry(objects[slot].value, 54), label, attached);
    replace.group.hidden = false;
    replace.keep.focus();
    note(`Exhibit ${slot + 1} already has content.`);
  }

  /** Write one catalogue result into one exhibit through the same title field,
   * source link, page and cover state as every other edit. A replacement also
   * releases the old page and local cover, because they belonged to the exhibit
   * being replaced; every other slot keeps its own content. */
  function applyPick(
    slot: number,
    pick: SearchPick,
    source: { href: string; provider: SourceProvider },
    label: string,
  ) {
    const filled = slot + 1;
    const removed = [
      hrefs[slot] ? `${sourceLink(hrefs[slot])?.provider ?? "Source"} source link` : "",
      livePage(slot) ? "web page" : "",
      covers[slot] ? "cover art" : "",
    ].filter(Boolean);
    const replaced = Boolean(objects[slot].value.trim() || removed.length);
    cancelLookup(slot);
    if (covers[slot]) {
      disposeCover(slot);
      renderCovers();
    }
    if (pageLinks[slot]) {
      pageLinks[slot] = null;
      pageTitles[slot] = "";
    }
    objects[slot].value = label;
    setLink(slot, source.href);
    const empty = firstEmpty();
    if (empty >= 0) target = empty;
    markTarget();
    renderPreview();
    note(`${entry(pick.title, 54)} ${replaced ? "replaced" : "added to"} exhibit ${filled}.${
      removed.length
        ? ` The previous ${replaceAttachmentList(removed)} ${removed.length === 1 ? "was" : "were"} removed.`
        : ""
    }${empty >= 0 ? ` Next pick fills exhibit ${target + 1}.` : ""}${
      albumWikiSearch && source.provider === "Wikidata"
        ? " The Wikidata link is release details only — paste an Apple Music or Spotify link for playback."
        : ""
    }`);
    update();
  }

  function fillFromPick(pick: SearchPick, button: HTMLButtonElement | null = null) {
    const source = sourceLink(pick.href);
    const name = entry(pick.title, 54);
    if (!source || !name) {
      note("That result has no usable Apple Music, Spotify, Apple Books, App Store or Wikidata link. Try another.");
      return;
    }
    const artist = entry(pick.artist, 48);
    const year = yearOf(pick.year);
    const slot = target;
    // Films, TV series and games read as "Dune (2021)"; the description is
    // shown in the result row, not typed into the exhibit. Wikidata album
    // picks get the same title/year and one metadata-only note: playback needs
    // a real Apple Music or Spotify link, never an inferred provider ID.
    const label = entry(source.provider === "Wikidata"
      ? year ? `${name} (${year})` : name
      : artist ? `${name} · ${artist}` : name, 54);
    // An occupied exhibit, or one already carrying a source link, page or local
    // cover, is never overwritten by one tap. The panel names both titles and
    // waits for an explicit choice; an empty, unattached slot keeps its fill.
    if (objects[slot].value.trim() || hasExhibitAttachment(slot)) {
      offerReplace(slot, pick, source, label, button);
      return;
    }
    applyPick(slot, pick, source, label);
  }

  /** A deliberate paste of an Apple Music song or album, Spotify album or
   * track, Apple Books, App Store app or exact Wikidata item link keeps the canonical link
   * (and, for music, its preview) immediately, then restores the public title
   * from that exact ID. Apple Music, Apple Books and the App Store also carry
   * the artist/author/developer, while Wikidata supplies a known item's own
   * label and, for media, a reliable year. It reuses the one-controller-per-slot
   * pendingLookups state above, so a replaced link, move, Undo or rebuilt board
   * cancels the same in-flight request and no parallel async state is needed.
   * A miss, an unsupported link or a failure leaves the link and manual title
   * entry alone, and only the same still-empty slot can be filled — never a
   * typed title, a replaced link, a moved exhibit or a rebuilt board. */
  async function fillSourceTitle(slot: number, href: string) {
    const apple = appleAlbumRef(href);
    const appleSong = appleSongRef(href);
    const spotify = spotifyAlbumRef(href);
    const spotifyTrack = spotifyTrackRef(href);
    const book = appleBookRef(href);
    const app = appleAppRef(href);
    const wiki = wikidataSource(href);
    if (!apple && !appleSong && !spotify && !spotifyTrack && !book && !app && !wiki) return;
    const provider = book ? "Apple Books" : apple || appleSong ? "Apple Music" : app ? "App Store"
      : wiki ? "Wikidata" : "Spotify";
    const attachment = book || app || wiki ? "link" : "link and preview";
    const controller = new AbortController();
    pendingLookups.get(slot)?.abort();
    pendingLookups.set(slot, controller);
    const filled = slot + 1;
    const untouched = () => albumTitleApplies({ href: hrefs[slot], title: objects[slot].value }, href);
    const offer = () => {
      if (untouched()) note(`Exhibit ${filled} keeps its ${provider} ${attachment}. Type its title, or search for it.`);
    };
    try {
      const found = book
        ? await lookupAppleBook(href, controller.signal)
        : apple
        ? await lookupAppleAlbum(href, controller.signal)
        : appleSong
        ? await lookupAppleSong(href, controller.signal)
        : app
        ? await lookupAppleApp(href, controller.signal)
        : wiki
        ? await lookupWikidataTitle(href, controller.signal)
        : spotify
        ? await lookupSpotifyAlbumTitle(href, controller.signal)
        : await lookupSpotifyTrackTitle(href, controller.signal);
      if (pendingLookups.get(slot) !== controller) return;
      pendingLookups.delete(slot);
      if (!found) {
        offer();
        return;
      }
      const label = typeof found === "string"
        ? entry(found, 54)
        : entry(found.artist ? `${found.title} · ${found.artist}` : found.title, 54);
      if (!objects[slot].isConnected || !label || !untouched()) return;
      if (replaceOffer?.slot === slot) clearReplace();
      objects[slot].value = label;
      refreshLinks();
      renderPreview();
      // Advance like an ordinary catalogue pick, but only while the selector
      // still points here; a deliberate retarget elsewhere must be preserved.
      if (target === slot) {
        const empty = firstEmpty();
        if (empty >= 0) target = empty;
        markTarget();
      }
      note(`Exhibit ${filled} is ${label}. Its ${provider} ${attachment} ${book || app || wiki ? "stays" : "stay"}.`);
      update();
    } catch {
      if (pendingLookups.get(slot) !== controller) return;
      pendingLookups.delete(slot);
      offer();
    }
  }

  /** One search of the active kind. The album and book fallbacks pass
   * wikiAlbums or wikiBooks to run the exact current term through the same
   * Wikidata catalogue instead — same two-request shape, same abort and
   * run-token protections, never automatic. */
  async function runSearch(wikiAlbums = false, wikiBooks = false) {
    const query = entry(music.query.value, 80);
    if (query.length < 2) {
      note("Enter at least two characters to search.");
      music.query.focus();
      return;
    }
    const country = music.country.value;
    const store = storeName();
    const requestedKind: SourceKind = kind;
    const wiki = wikiAlbums || wikiBooks || requestedKind === "film" || requestedKind === "series"
      || requestedKind === "game" || requestedKind === "language";
    const kindLabel =
      requestedKind === "album" ? "albums" : requestedKind === "song" ? "songs"
      : requestedKind === "book" ? "books" : requestedKind === "app" ? "apps"
      : requestedKind === "film" ? "films" : requestedKind === "series" ? "TV series"
      : requestedKind === "game" ? "games" : "programming languages";
    // Games alone carry the platform filter, read from the selector beside the
    // Games button. All is the original search; any other kind always uses All.
    const platform: GamePlatformFilter = requestedKind === "game"
      ? music.platform.value === "pc" ? "pc" : music.platform.value === "console" ? "console" : "all"
      : "all";
    const gameFilter = requestedKind === "game" && platform !== "all";
    const searchLabel = gameFilter ? platform === "pc" ? "PC games" : "console games" : kindLabel;
    // Apps have no fallback. Book searches keep Apple Books as the default and
    // add only the deliberate Wikidata-books action; album searches keep their
    // Apple/Spotify links and the explicit Wikidata-album action.
    const offerRecovery = () => {
      if (requestedKind === "app") return;
      if (requestedKind === "book") {
        showRecovery(query, country, false, false, true);
        return;
      }
      showRecovery(query, country, wiki && !wikiAlbums && !wikiBooks, requestedKind === "album");
    };
    searching?.abort();
    const controller = new AbortController();
    searching = controller;
    const run = ++searchRun;
    albumWikiSearch = wikiAlbums;
    music.submit.disabled = true;
    clearResults();
    hideRecovery();
    note(wikiAlbums ? `Searching Wikidata albums for “${query}”…`
      : wikiBooks ? `Searching Wikidata books for “${query}”…`
      : wiki ? `Searching Wikidata ${searchLabel} for “${query}”…`
      : `Searching ${store} ${kindLabel} for “${query}”…`);
    try {
      const picks = requestedKind === "book"
        ? wikiBooks
          ? await searchWikidata(query, "book", controller.signal)
          : await searchBooks(query, country, controller.signal)
        : requestedKind === "app"
        ? await searchApps(query, country, controller.signal)
        : wikiAlbums
        ? await searchWikidata(query, "album", controller.signal)
        : requestedKind === "film" || requestedKind === "series" || requestedKind === "game"
          || requestedKind === "language"
        ? await searchWikidata(query, requestedKind, controller.signal, platform)
        : await searchMusic(query, requestedKind, country, controller.signal);
      if (run !== searchRun || controller.signal.aborted) return;
      const usable = picks.filter((pick) => pick && typeof pick.title === "string" && sourceLink(pick.href));
      if (!usable.length) {
        note(wikiAlbums
          ? `No albums matched “${query}” on Wikidata. Coverage is partial — search again with a shorter title, or paste an Apple Music, Spotify or Wikidata link.`
          : wikiBooks
          ? `No books matched “${query}” on Wikidata. Coverage is partial — try a shorter title, or paste an Apple Books or Wikidata link.`
          : wiki && gameFilter
          ? `No ${searchLabel} matched “${query}” on Wikidata. Try All games for titles with no recorded platform, a shorter title, or a pasted Wikidata link.`
          : wiki
          ? `No ${kindLabel} matched “${query}” on Wikidata. Try a shorter title, switch the type, or paste a Wikidata link.`
          : `No ${kindLabel} matched “${query}” in ${store}. Try a shorter title, switch the type, change storefront, or paste a link.`);
        offerRecovery();
        return;
      }
      renderResults(usable);
      offerRecovery();
    } catch (error) {
      if (run !== searchRun || controller.signal.aborted) return;
      // A Wikidata rate limit is worth its own words: show it and wait for the
      // person, never retrying automatically.
      note(wiki && error instanceof Error && error.message.includes("429")
        ? "Wikidata is limiting requests right now. Wait a little, then search again."
        : wiki
        ? "Search didn’t come back. Check your connection and try again, or paste a Wikidata link below."
        : "Search didn’t come back. Check your connection and try again, or paste an Apple Music, Spotify, Apple Books, App Store or Wikidata link below.");
      offerRecovery();
    } finally {
      if (run === searchRun) {
        searching = null;
        music.submit.disabled = false;
      }
    }
  }

  function applyDraft(draft: NineDraft) {
    // Covers are browser-only, so a draft restore has to decide which local
    // covers still belong to the exhibits it brings back. Compare before the
    // inputs change: an exact title and canonical source match keeps its cover.
    const restoredItems = objects.map((_, index) => draft.items[index] ?? "");
    const restoredHrefs = normaliseSourceLinks(draft.hrefs);
    // A decode still running for the previous board must not land on this one.
    coverRun += 1;
    let cleared = 0;
    objects.forEach((input, index) => {
      if (!covers[index]) return;
      if (input.value === restoredItems[index] && hrefs[index] === restoredHrefs[index]) return;
      disposeCover(index);
      cleared += 1;
    });
    if (cleared) {
      renderCovers();
      coverNote(`Covers cleared from ${cleared} exhibit${cleared === 1 ? "" : "s"} whose title or source changed with the draft.`);
    }
    title.value = draft.title;
    subtitle.value = draft.subtitle ?? "";
    objects.forEach((input, index) => { input.value = restoredItems[index]; });
    byline.value = draft.byline ?? "";
    dateInput.value = draft.date ?? "";
    if (profile) profile.value = draft.profile ?? "";
    if (profileStatus) profileStatus.textContent = "";
    chooseSkin.value = String(draft.skin ?? 0);
    rankedBox.checked = draft.ranked === true;
    discardMove();
    discardFill();
    cancelLookup();
    closePreview(false);
    clearReplace();
    hrefs = restoredHrefs;
    pageLinks = trimPages(draft.pages);
    pageTitles = objects.map((input) => input.value.trim());
    if (hrefs.some(Boolean)) music.panel.open = true;
    if (pageLinks.some(Boolean)) page.panel.open = true;
    const empty = firstEmpty();
    target = empty < 0 ? 0 : empty;
    markTarget();
    refreshLinks();
    renderPreview();
    pickSkin();
    update();
  }

  root.addEventListener("input", () => {
    renderPreview();
    update();
  });
  rankedBox.addEventListener("change", () => {
    renderPreview();
    update();
  });
  preset.addEventListener("change", () => {
    if (preset.value) title.value = preset.value;
    renderPreview();
    if (preset.value === "Nine albums I took everywhere") {
      music.panel.open = true;
      music.query.focus();
    }
    update();
  });

  /** One swap keeps an exhibit's title, canonical source link and local cover together. */
  function swapExhibits(from: number, to: number) {
    if (replaceOffer && (replaceOffer.slot === from || replaceOffer.slot === to)) clearReplace();
    cancelLookup(from);
    cancelLookup(to);
    const first = objects[from].value;
    objects[from].value = objects[to].value;
    objects[to].value = first;
    [hrefs[from], hrefs[to]] = [hrefs[to], hrefs[from]];
    [pageLinks[from], pageLinks[to]] = [pageLinks[to], pageLinks[from]];
    [pageTitles[from], pageTitles[to]] = [pageTitles[to], pageTitles[from]];
    [covers[from], covers[to]] = [covers[to], covers[from]];
    if (lastFill) {
      lastFill.indexes = lastFill.indexes.map((index) => index === from ? to : index === to ? from : index);
    }
    if (previewIndex === from || previewIndex === to) closePreview(false);
    refreshLinks();
    renderCovers();
    renderPreview();
    order.value = String(to);
    updateSwapButton();
    update();
  }

  function rememberMove(from: number, to: number) {
    lastMove = { from, to };
    undoMove.disabled = false;
  }

  function discardMove() {
    lastMove = null;
    undoMove.disabled = true;
  }

  function updateSwapButton() {
    swapSlots.disabled = order.value === swapTarget.value;
  }

  /** Every reorder — buttons, selects and the drag handle — takes this one
   * path, so bounds, attachments, status and the single undo stay identical. */
  function moveExhibit(from: number, to: number) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= objects.length || to < 0 || to >= objects.length || from === to) return;
    swapExhibits(from, to);
    rememberMove(from, to);
    draftStatus.textContent = `Exhibit ${from + 1} moved to slot ${to + 1}. Undo last move is in the Move controls.`;
  }

  elements<HTMLButtonElement>(root, "[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveExhibit(Number(order.value), Number(order.value) + Number(button.dataset.move)));
  });
  order.addEventListener("change", updateSwapButton);
  swapTarget.addEventListener("change", updateSwapButton);
  swapSlots.addEventListener("click", () => moveExhibit(Number(order.value), Number(swapTarget.value)));
  undoMove.addEventListener("click", () => {
    if (!lastMove) return;
    const { from, to } = lastMove;
    swapExhibits(to, from);
    discardMove();
    order.focus({ preventScroll: true });
    draftStatus.textContent = `Move undone. Exhibit ${from + 1} is back in slot ${from + 1}.`;
  });

  const slotLabels = objects.map((input) => input.closest<HTMLElement>("label")!);
  function markDropSlot(label: HTMLElement | null) {
    slotLabels.forEach((slot) => {
      if (slot === label) slot.setAttribute("data-drop-slot", "");
      else slot.removeAttribute("data-drop-slot");
    });
  }
  function clearDrag() {
    activeDrag = null;
    markDropSlot(null);
  }
  function draggedSlot(event: DragEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>("label")?.querySelector<HTMLInputElement>("[data-object]") ?? null;
  }

  dragHandles.forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      const from = Number(handle.dataset.dragSlot);
      const data = event.dataTransfer;
      if (!data || !Number.isInteger(from) || from < 0 || from >= objects.length) return;
      activeDrag = { from, board: boardDragId };
      data.effectAllowed = "move";
      // A private type with a harmless board token: no link, text or file is
      // read from the payload, and no foreign drag can match this board.
      data.setData(dragType, boardDragId);
    });
    handle.addEventListener("dragend", clearDrag);
  });

  exhibitionBoard.addEventListener("dragover", (event) => {
    const data = event.dataTransfer;
    if (!data || !data.types.includes(dragType)) return;
    if (!activeDrag || activeDrag.board !== boardDragId) return;
    const slot = draggedSlot(event);
    if (!slot) return;
    const to = Number(slot.dataset.object);
    if (!Number.isInteger(to) || to === activeDrag.from) return;
    event.preventDefault();
    data.dropEffect = "move";
    markDropSlot(slot.closest<HTMLElement>("label"));
  });

  exhibitionBoard.addEventListener("dragleave", (event) => {
    if (!exhibitionBoard.contains(event.relatedTarget as Node | null)) markDropSlot(null);
  });

  exhibitionBoard.addEventListener("drop", (event) => {
    const data = event.dataTransfer;
    const drag = activeDrag;
    clearDrag();
    if (!data || !data.types.includes(dragType)) return;
    if (!drag || drag.board !== boardDragId) return;
    const slot = draggedSlot(event);
    if (!slot) return;
    const to = Number(slot.dataset.object);
    if (!Number.isInteger(to) || to === drag.from) return;
    moveExhibit(drag.from, to);
  });

  /** Slots a pasted list may claim: no visible title and no staged source
   * link, page or cover, so a fill never takes over someone else's attachment. */
  function hasExhibitAttachment(index: number) {
    return Boolean(hrefs[index] || livePage(index) || covers[index]);
  }

  /** Undo compares the filled page and music source themselves, so only a local
   * cover it could not have written blocks clearing an otherwise exact row. */
  function hasFillBlocker(index: number) {
    return Boolean(covers[index]);
  }

  function listSlots() {
    return objects
      .map((input, index) => (!input.value.trim() && !hasExhibitAttachment(index) ? index : -1))
      .filter((index) => index >= 0);
  }

  /** The count beside the paste box, refreshed from the current text and board. */
  function showListCount() {
    const open = listSlots();
    const plan = planNineList(list.text.value, open);
    list.status.textContent = nineListSummary(plan, open.length);
    list.fill.disabled = plan.indexes.length === 0;
  }
  function discardFill() {
    lastFill = null;
    list.undo.disabled = true;
  }

  /** Write one line through the exhibit's ordinary input path so the preview,
   * draft, alt text and exports see it exactly as if it were typed. */
  function setExhibit(index: number, value: string) {
    objects[index].value = value;
    objects[index].dispatchEvent(new Event("input", { bubbles: true }));
  }

  list.text.addEventListener("input", showListCount);
  list.panel.addEventListener("toggle", () => {
    if (list.panel.open) showListCount();
  });
  list.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const open = listSlots();
    const plan = planNineList(list.text.value, open);
    if (!plan.lines.length && !plan.invalid.length) {
      list.status.textContent = "Paste at least one exhibit title, one per line. A second column can hold a public HTTPS page; a third can hold an exact Apple Music or Spotify album or track link.";
      list.text.focus();
      return;
    }
    if (!plan.indexes.length) {
      list.status.textContent = nineListSummary(plan, open.length);
      return;
    }
    plan.indexes.forEach((index, line) => setExhibit(index, plan.titles[line]));
    // A second column attaches after its title exists, through the same local
    // page state as the page form: an ordinary outbound address, never fetched.
    plan.urls.forEach((url, line) => {
      if (!url) return;
      const index = plan.indexes[line];
      pageLinks[index] = url;
      pageTitles[index] = plan.titles[line];
    });
    // Only the third column becomes a music source. Store its canonical href
    // directly: a list fill never looks up a title, mounts a player or fetches.
    plan.sources.forEach((source, line) => {
      if (source) hrefs[plan.indexes[line]] = source;
    });
    if (plan.urls.some(Boolean) || plan.sources.some(Boolean)) {
      if (plan.urls.some(Boolean)) page.panel.open = true;
      if (plan.sources.some(Boolean)) music.panel.open = true;
      markPageTarget();
      markTarget();
      refreshLinks();
      renderPreview();
      update();
    }
    lastFill = {
      indexes: plan.indexes.slice(), titles: plan.titles.slice(),
      urls: plan.urls.slice(), sources: plan.sources.slice(), rows: plan.rows.slice(),
    };
    list.undo.disabled = false;
    // Unplaced and invalid rows stay in the editor, raw and ordered, for the next fill or an edit.
    list.text.value = plan.remaining.join("\n");
    list.status.textContent = nineListApplied(plan, listSlots().length);
    list.fill.disabled = planNineList(list.text.value, listSlots()).indexes.length === 0;
    if (objects[target]?.value.trim()) {
      const empty = firstEmpty();
      if (empty >= 0) target = empty;
      markTarget();
    }
  });
  /** One Undo reverses the whole fill: every slot still holding the exact
   * title, page and music source this fill wrote is cleared, and those raw rows
   * return to the paste box. A slot the person has since edited, retitled,
   * relinked or added a cover to keeps their work, and its row is not duplicated. */
  list.undo.addEventListener("click", () => {
    if (!lastFill) return;
    const filled = lastFill;
    const currentPages = objects.map((_, index) => livePage(index));
    const currentSources = hrefs.slice();
    const plan = planNineListUndo(filled, objects.map((input) => input.value), hasFillBlocker, currentPages, currentSources);
    plan.clear.forEach((index) => {
      if (replaceOffer?.slot === index) clearReplace();
      pageLinks[index] = null;
      pageTitles[index] = "";
      if (hrefs[index]) setLink(index, null);
      setExhibit(index, "");
    });
    if (plan.clear.length) {
      renderPages();
      renderPreview();
    }
    const staying = listSlots().length;
    list.text.value = plan.restored.concat(
      list.text.value.split(/\r?\n/).filter((line) => line.trim()),
    ).join("\n");
    discardFill();
    const cleared = plan.clear.length;
    list.status.textContent = `Fill undone · ${cleared} exhibit${cleared === 1 ? "" : "s"} cleared${plan.pages ? ` · ${plan.pages} page${plan.pages === 1 ? "" : "s"} removed` : ""}${plan.sources ? ` · ${plan.sources} music link${plan.sources === 1 ? "" : "s"} removed` : ""} · ${staying} empty slot${staying === 1 ? "" : "s"}${plan.kept ? ` · ${plan.kept} kept your later edit` : ""}.`;
    list.fill.disabled = planNineList(list.text.value, listSlots()).indexes.length === 0;
    list.text.focus({ preventScroll: true });
  });
  cover.target.addEventListener("change", () => {
    coverTarget = Number(cover.target.value);
    markCoverTarget();
  });
  cover.panel.addEventListener("toggle", markCoverTarget);
  page.target.addEventListener("change", markPageTarget);
  page.panel.addEventListener("toggle", markPageTarget);
  cover.file.addEventListener("change", () => {
    const file = cover.file.files?.[0];
    // Reset the input so picking the same file again after a removal re-fires.
    cover.file.value = "";
    if (file) void hangCover(file);
  });

  music.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSearch();
  });
  /** The album-only explicit fallback: the exact current term, one strict
   * Wikidata album search, never a link, auto-fetch or retry. Editing the
   * query or switching kind clears the recovery area first, so the action
   * only runs for the term that offered it. The book fallback is the same
   * deliberate action through the shared two-call adapter. */
  music.recoveryAlbums.addEventListener("click", () => {
    if (kind !== "album" || entry(music.query.value, 80).length < 2) return;
    void runSearch(true);
  });
  music.recoveryBooks.addEventListener("click", () => {
    if (kind !== "book" || entry(music.query.value, 80).length < 2) return;
    void runSearch(false, true);
  });
  music.more.addEventListener("click", () => {
    if (shownResults >= resultPicks.length) return;
    revealResults(true);
  });
  function clearSearch() {
    searching?.abort();
    searchRun += 1;
    albumWikiSearch = false;
    music.submit.disabled = false;
    clearResults();
    hideRecovery();
    note("");
  }
  music.query.addEventListener("input", clearSearch);
  music.country.addEventListener("change", clearSearch);
  music.kind.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.musicKind;
      kind = next === "song" || next === "book" || next === "app"
        || next === "film" || next === "series" || next === "game"
        || next === "language" ? next : "album";
      music.kind.forEach((each) => each.setAttribute("aria-pressed", String(each.dataset.musicKind === kind)));
      // Films, TV series, games and programming languages come from Wikidata,
      // so the storefront does not apply.
      const wiki = kind === "film" || kind === "series" || kind === "game"
        || kind === "language";
      music.storefront.hidden = wiki;
      music.coverage.hidden = !wiki;
      // The platform filter belongs to Games alone; every other kind hides it
      // and keeps its own search exactly as before.
      const games = kind === "game";
      music.platformField.hidden = !games;
      music.gameCoverage.hidden = !games;
      clearSearch();
    });
  });
  /** A changed platform filter applies to the next submitted search; results
   * from the previous filter are cleared rather than silently relabelled. */
  music.platform.addEventListener("change", () => {
    clearSearch();
    note(music.platform.value === "all" ? "" : "Platform filter set. Search again to apply it.");
  });
  music.target.addEventListener("change", () => {
    // Choosing another exhibit is navigation away from the prompt's target.
    clearReplace();
    target = Number(music.target.value);
    markTarget();
  });
  music.panel.addEventListener("toggle", () => {
    if (!music.panel.open) {
      closePreview(false);
      clearReplace();
    }
    markTarget();
  });
  replace.keep.addEventListener("click", () => {
    const slot = replaceOffer?.slot;
    clearReplace(true);
    if (slot !== undefined) note(`Exhibit ${slot + 1} kept as it is.`);
  });
  replace.confirm.addEventListener("click", () => {
    const offer = replaceOffer;
    if (!offer) return;
    const slot = offer.slot;
    const current = {
      slot,
      title: objects[slot].value,
      href: hrefs[slot],
      page: livePage(slot),
      cover: covers[slot],
    };
    // The prompt is worth nothing if its slot is no longer the target or has
    // changed since it was read: close it and leave the board alone.
    const applies = slot === target && Number(music.target.value) === slot
      && objects[slot].isConnected && replaceOfferApplies(offer, current);
    clearReplace(true);
    if (!applies) {
      note(`Exhibit ${slot + 1} changed after you read that prompt, so nothing was replaced. Choose the result again to replace it.`);
      return;
    }
    applyPick(slot, offer.pick, offer.source, offer.label);
  });
  replace.group.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    replace.keep.click();
  });
  music.previewClose.addEventListener("click", () => closePreview());
  music.preview.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || music.preview.hidden) return;
    event.preventDefault();
    closePreview();
  });

  music.pasteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const source = sourceLink(music.paste.value.trim());
    if (!source) {
      note("That isn’t an Apple Music, Spotify, Apple Books, App Store or Wikidata link. Copy the share link from its page in the app, store or on Wikidata.");
      music.paste.focus();
      music.paste.select();
      return;
    }
    const slot = target;
    const typed = Boolean(objects[slot].value.trim());
    const filled = slot + 1;
    setLink(slot, source.href);
    music.paste.value = "";
    if (typed) {
      const empty = firstEmpty();
      if (empty >= 0) target = empty;
      markTarget();
    }
    note(`${source.provider} link added to exhibit ${filled}. ${typed ? "Its title stays as you typed it." : "Add its title."}`);
    update();
    // Only an empty exhibit needs a title. One deliberate Apple Music, Spotify,
    // Apple Books, App Store or exact Wikidata paste gets one bounded exact-ID
    // lookup after the link and any music preview exist; a typed title keeps
    // exactly what was written.
    if (!typed) void fillSourceTitle(slot, source.href);
  });
  /** Attach one exact public page to a title the person typed. Replacing an
   * existing page is a second deliberate submit; nothing is fetched or embedded. */
  page.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const href = pageLink(page.input.value);
    if (!href) {
      page.status.textContent = "That isn’t a public HTTPS page. Use a full address beginning with https://.";
      page.input.focus();
      page.input.select();
      return;
    }
    const slot = Number(page.target.value);
    const name = objects[slot]?.value.trim() ?? "";
    if (!name) {
      page.status.textContent = `Type exhibit ${slot + 1}’s title first, then attach its page.`;
      objects[slot].focus();
      return;
    }
    const previous = livePage(slot);
    if (replaceOffer?.slot === slot) clearReplace();
    pageLinks[slot] = href;
    pageTitles[slot] = name;
    page.input.value = "";
    renderPages();
    renderPreview();
    page.status.textContent = `Exhibit ${slot + 1} links to ${href}.${previous && previous !== href
      ? " The previous page was replaced."
      : " Its title stays as you typed it."}`;
    update();
  });
  objects.forEach((input, index) => {
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text")?.trim() ?? "";
      const source = sourceLink(text);
      if (!source) return;
      event.preventDefault();
      const typed = input.value.trim();
      setLink(index, source.href);
      if (!typed || /^https?:\/\//i.test(typed)) input.value = "";
      if (prunePages()) {
        renderPages();
        renderPreview();
      }
      note(`Exhibit ${index + 1} has a ${source.provider} link. ${input.value.trim() ? "Its title stays as you typed it." : "Type its title, or search for it."}`);
      update();
    });
    input.addEventListener("input", () => {
      // Typing in the slot the prompt named changes the exhibit it described.
      if (replaceOffer?.slot === index) clearReplace();
      // A page belongs to the exact title it was attached to. Changing that
      // title detaches it explicitly instead of leaving a stale address.
      if (pageLinks[index] && pageTitles[index] !== input.value.trim()) {
        pageLinks[index] = null;
        pageTitles[index] = "";
        page.status.textContent = `Exhibit ${index + 1} no longer has its web page link because its title changed. Attach the page again if it still belongs.`;
        renderPages();
        renderPreview();
      }
      if (input.value.trim()) return;
      const hadLink = Boolean(hrefs[index]);
      const hadCover = Boolean(covers[index]);
      if (!hadLink && !hadCover) return;
      if (hadLink) setLink(index, null);
      if (hadCover) disposeCover(index);
      if (hadCover) {
        renderCovers();
        renderPreview();
      }
      note(`Exhibit ${index + 1} is empty, so its ${
        hadLink && hadCover ? "source link and cover were" : hadLink ? "source link was" : "cover was"
      } removed.`);
    });
  });

  /** The board as the portable file sees it: the same fields Save draft writes. */
  const boardDraft = (): NineDraft => ({
    title: title.value,
    subtitle: subtitle.value,
    items: objects.map((input) => input.value),
    byline: byline.value,
    date: dateInput.value,
    profile: profile?.value,
    skin: Number(chooseSkin.value),
    ranked: rankedBox.checked ? true : undefined,
    hrefs: hrefs.slice(),
    pages: objects.map((_, index) => livePage(index)),
  });
  saveDraft.addEventListener("click", () => {
    const outcome = writeNineDraft(storage, boardDraft());
    if (outcome === "saved") {
      openDraft.hidden = true;
      const rawProfile = profile?.value.trim() ?? "";
      draftStatus.textContent = rawProfile && !profileUrl(rawProfile)
        ? "Saved on this device without the profile link, which isn’t a public HTTPS profile address."
        : "Saved on this device. It opens next time you visit in this browser.";
    } else if (outcome === "empty") {
      draftStatus.textContent = "Enter a title or an exhibit before saving.";
    } else if (outcome === "too-large") {
      draftStatus.textContent = "This draft is too long to save here. Shorten an exhibit, then save again.";
    } else {
      draftStatus.textContent = "This browser blocked local storage, so nothing was saved. Keep this tab open to finish.";
    }
  });
  openDraft.addEventListener("click", () => {
    const draft = readNineDraft(storage);
    openDraft.hidden = true;
    if (!draft) {
      draftStatus.textContent = "That saved draft is no longer on this device.";
      return;
    }
    applyDraft(draft);
    draftStatus.textContent = "Saved draft opened. The shared result stays in the link you followed.";
  });
  clearDraft.addEventListener("click", () => {
    if (!clearNineDraft(storage)) {
      draftStatus.textContent = "This browser would not clear the saved draft. Your exhibition is unchanged.";
      return;
    }
    openDraft.hidden = true;
    discardMove();
    clearReplace();
    draftStatus.textContent = "Saved draft cleared from this device. Your exhibition is still here.";
  });

  const boardSignature = () => JSON.stringify({
    draft: boardDraft(),
    coverRun,
    covers: covers.map((cover) => cover ? [cover.url, cover.fit] : null),
  });
  const draftFileSize = `${Math.round(draftFileLimit / 1024)} KB`;
  /** One honest message for the first reason a file cannot fill the board. */
  function draftFileProblem(read: NineDraftFileRead): string {
    if (read.fault === "oversized") {
      return `That draft file is larger than ${draftFileSize}. This board is unchanged.`;
    }
    if (read.fault === "unreadable") return "That file is not valid JSON. This board is unchanged.";
    if (read.fault === "version") {
      return "That draft file uses a format this page does not know. Download a fresh draft file here, then open that. This board is unchanged.";
    }
    if (read.fault === "schema") return "That is not a Composer Top Nine draft file. This board is unchanged.";
    if (read.fault === "empty") return "That draft file has no title or exhibit to open. This board is unchanged.";
    if (read.fault === "shape") {
      return "That draft file is missing its nine exhibit slots or carries a link, style or ranking value this board cannot use. This board is unchanged.";
    }
    return "That draft file could not be opened. This board is unchanged.";
  }

  /** Download the current board as one bounded, versioned private file. Nothing
   * is stored or sent; covers stay out because they belong to this session. */
  saveDraftFile.addEventListener("click", () => {
    const text = writeNineDraftFile(boardDraft());
    if (!text) {
      draftFileStatus.textContent = "Enter a title or an exhibit before downloading a draft file.";
      return;
    }
    // Read the exact bytes back first, so the download is the same shape and
    // bound the Open draft file control accepts.
    if (!readNineDraftFile(text).draft) {
      draftFileStatus.textContent = "This board is too large for one draft file. Shorten a title, exhibit or link, then download again.";
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = draftFileName;
      link.rel = "noopener";
      link.click();
    } catch {
      draftFileStatus.textContent = "This browser didn’t start the download. This board is unchanged; try again.";
      return;
    } finally {
      // Release the blob URL once the browser has had time to start the
      // download, on success or failure, so the page never leaks one.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    draftFileStatus.textContent = "Draft file ready. Download a PNG to keep the cover images.";
  });

  // A second pick, or a later typed edit, outranks a slower read of the first.
  let draftFileAttempt = 0;
  openDraftFile.addEventListener("change", async () => {
    const file = openDraftFile.files?.[0];
    if (!file) return;
    const attempt = ++draftFileAttempt;
    const before = boardSignature();
    try {
      // Refuse a runaway file before reading or parsing any of it.
      if (!Number.isFinite(file.size) || file.size > draftFileLimit) {
        draftFileStatus.textContent = `That draft file is larger than ${draftFileSize}. This board is unchanged.`;
        return;
      }
      const text = await file.text();
      if (attempt !== draftFileAttempt) return;
      if (boardSignature() !== before) {
        draftFileStatus.textContent = "The draft file arrived after you changed this board. Open it again to replace what you have now.";
        return;
      }
      const read = readNineDraftFile(text);
      if (!read.draft) {
        draftFileStatus.textContent = draftFileProblem(read);
        return;
      }
      // The same restore path the browser's saved draft uses: covers are
      // reconciled, links and pages validated, and the preview follows.
      applyDraft(read.draft);
      openDraft.hidden = true;
      draftFileStatus.textContent = "Draft file opened. Save draft here to keep it in this browser.";
    } catch {
      if (attempt !== draftFileAttempt) return;
      draftFileStatus.textContent = "That file could not be read on this device. This board is unchanged.";
    } finally {
      if (attempt === draftFileAttempt) openDraftFile.value = "";
    }
  });

  markTarget();
  refreshLinks();
  markCoverTarget();
  markPageTarget();
  renderCovers();
  showListCount();
  renderPreview();
  if (previewGrid) previewGrid.hidden = false;
  // The file controls are JavaScript-only, so they stay disabled until every
  // listener above is attached.
  for (const control of [saveDraftFile, openDraftFile]) control.disabled = false;

  return {
    result: () => {
      const items = objects.map((input) => entry(input.value, 54));
      const heading = entry(title.value, 72);
      if (!heading || !items.every(Boolean)) return null;
      const line = entry(subtitle.value, nineSubtitleLimit);
      const links = hrefs.some(Boolean) ? hrefs.slice() : undefined;
      const pageOut = objects.map((_, index) => livePage(index));
      const profileHref = profile ? profileUrl(profile.value) : null;
      const date = topNineDate(dateInput.value);
      return {
        title: heading, items,
        ...(line ? { subtitle: line } : {}),
        ...(links ? { hrefs: links } : {}),
        ...(pageOut.some(Boolean) ? { pages: pageOut } : {}),
        ...(profileHref ? { profile: profileHref } : {}),
        ...(date ? { date } : {}),
        ...(rankedBox.checked ? { ranked: true } : {}),
      };
    },
    exportCovers: () => (covers.some(Boolean)
      ? covers.map((slot) => slot ? { art: slot.art, fit: slot.fit } : null)
      : null),
    restore(snapshot) {
      const items = snapshot.items;
      const heading = entry(snapshot.title, 72);
      if (!heading || !Array.isArray(items) || items.length !== 9) return;
      title.value = heading;
      subtitle.value = entry(snapshot.subtitle, nineSubtitleLimit);
      objects.forEach((input, index) => { input.value = entry(items[index], 54); });
      dateInput.value = topNineDate(snapshot.date);
      rankedBox.checked = snapshot.ranked === true;
      // A shared hash is untrusted input: only a validated HTTPS profile
      // address restores, and an unsafe one leaves the field empty.
      if (profile) profile.value = profileUrl(snapshot.profile) ?? "";
      if (profileStatus) profileStatus.textContent = "";
      discardMove();
      discardFill();
      cancelLookup();
      closePreview(false);
      clearReplace();
      hrefs = trimHrefs(snapshot.hrefs);
      pageLinks = trimPages(snapshot.pages);
      pageTitles = objects.map((input) => input.value.trim());
      if (hrefs.some(Boolean)) music.panel.open = true;
      if (pageLinks.some(Boolean)) page.panel.open = true;
      const empty = firstEmpty();
      target = empty < 0 ? 0 : empty;
      markTarget();
      refreshLinks();
      renderPreview();
      update();
    },
    resumeDraft(protectShared) {
      const draft = readNineDraft(storage);
      if (!draft) return;
      if (protectShared) {
        openDraft.hidden = false;
        draftStatus.textContent = "Open your saved draft to return to your own exhibition.";
        return;
      }
      applyDraft(draft);
      draftStatus.textContent = "Draft from this device restored. Save again to update it.";
    },
  };
}

/** One resized photo for a written question, kept in this tab. Each editor
 * row and applied run owns the URLs through which it shows those bytes. */
interface DraftQuestionPhoto {
  url: string;
  blob: Blob;
}

interface DraftPhotoRow {
  photo: DraftQuestionPhoto | null;
  /** Bumped when a newer selection or a clear makes an arriving decode stale. */
  run: number;
  /** A selected photo is still being read or decoded. */
  pending: boolean;
}

function mountThisOrThat(
  root: HTMLElement,
  update: () => void,
  dropSharedByline: () => void,
): Controller {
  const panels = elements<HTMLElement>(root, "[data-question]");
  const progress = root.querySelector<HTMLElement>("[data-tot-progress]")!;
  const packSelect = root.querySelector<HTMLSelectElement>("[data-tot-pack]")!;
  const description = root.querySelector<HTMLElement>("[data-tot-description]");
  const undo = root.querySelector<HTMLButtonElement>("[data-tot-undo]")!;
  const result = root.querySelector<HTMLElement>("[data-tot-result]")!;
  const revealTitle = result.querySelector<HTMLElement>("[data-reveal-title]")!;
  const revealPicks = result.querySelector<HTMLElement>("[data-reveal-picks]")!;
  const revealNote = result.querySelector<HTMLElement>("[data-tot-reveal-note]");
  const revealNoteBuiltin = revealNote?.textContent ?? "";
  const comparePanel = result.querySelector<HTMLElement>("[data-tot-compare-panel]");
  const compareButton = result.querySelector<HTMLButtonElement>("[data-tot-compare]");
  const compareResult = result.querySelector<HTMLElement>("[data-tot-compare-result]");
  const compareSummary = result.querySelector<HTMLElement>("[data-tot-compare-summary]");
  const compareRows = result.querySelector<HTMLElement>("[data-tot-compare-rows]");
  /** The validated prior choices of one shared built-in result, held only in
   * this tab. Any starter change, custom play, restart or restore clears it,
   * so a count can never describe two different runs. */
  let comparison: { pack: ThisOrThatPack; picks: ThisOrThatSide[] } | null = null;
  /** True only during the replay started by the explicit compare action. */
  let comparing = false;
  const blank = root.querySelector<HTMLElement>("[data-tot-blank]")!;
  const blankCopy = root.querySelector<HTMLButtonElement>("[data-tot-blank-copy]")!;
  const blankManual = root.querySelector<HTMLInputElement>("[data-tot-blank-manual]")!;
  const blankStatus = root.querySelector<HTMLElement>("[data-tot-blank-status]")!;
  let blankCopyAttempt = 0;
  const restart = root.querySelector<HTMLButtonElement>("[data-restart]")!;
  const customPanel = root.querySelector<HTMLDetailsElement>("[data-tot-custom]")!;
  const customForm = root.querySelector<HTMLFormElement>("[data-tot-custom-form]")!;
  const customStatus = root.querySelector<HTMLElement>("[data-custom-status]")!;
  const draftFileSave = root.querySelector<HTMLButtonElement>("[data-tot-draft-file-save]")!;
  const draftFileInput = root.querySelector<HTMLInputElement>("[data-tot-draft-file]")!;
  const draftFileStatus = root.querySelector<HTMLElement>("[data-tot-draft-file-status]")!;
  const customPrompts = elements<HTMLInputElement>(root, "[data-tot-custom-prompt]");
  const customLefts = elements<HTMLInputElement>(root, "[data-tot-custom-left]");
  const customRights = elements<HTMLInputElement>(root, "[data-tot-custom-right]");
  const customRows = elements<HTMLFieldSetElement>(root, "[data-tot-custom-form] fieldset");
  const lengthSelect = root.querySelector<HTMLSelectElement>("[data-tot-length]")!;
  const customPhotos = elements<HTMLInputElement>(root, "[data-tot-custom-photo]");
  const customPhotoPicks = elements<HTMLButtonElement>(root, "[data-tot-custom-photo-pick]");
  const customPhotoPreviews = elements<HTMLImageElement>(root, "[data-tot-custom-photo-preview]");
  const customPhotoClears = elements<HTMLButtonElement>(root, "[data-tot-custom-photo-clear]");
  const customPhotoAlts = elements<HTMLInputElement>(root, "[data-tot-custom-photo-alt]");
  const customPhotoStatuses = elements<HTMLElement>(root, "[data-tot-custom-photo-status]");
  let picks: (0 | 1 | null)[] = thisOrThatStart();
  let pack: ThisOrThatPack = "maker";
  let heading: string = thisOrThatPacks.maker.title;
  /** The written set now on stage — five, nine or eleven — or null while a
   * built-in starter plays. Built-in starters are always the authored five. */
  let custom: readonly (readonly [string, string, string])[] | null = null;
  /** The length the editor is writing for. Five is the default; nine and
   * eleven are optional private authored lengths. Switching edits only the editor. */
  let customLength: ThisOrThatLength = thisOrThatCount;
  /** The editor's photo drafts, one per row. A cleared or replaced photo only
   * changes this draft; the applied snapshot below owns its own URLs. */
  let photoRows: DraftPhotoRow[] = Array.from({ length: thisOrThatDraftRowCount }, () => ({ photo: null, run: 0, pending: false }));
  /** The editor revision at which each native photo picker opened. A selection
   * arriving after a draft replacement belongs to the old text and is refused. */
  let photoPickRevisions: (number | undefined)[] = Array.from({ length: thisOrThatDraftRowCount }, () => undefined);
  /** Photos frozen into the active written run, with their own object URLs so
   * replacing or clearing an editor photo cannot break what is playing. */
  let appliedPhotos: (ThisOrThatPromptPhoto | null)[] = [];
  /** A local draft read belongs to the editor revision it started from. A newer
   * file pick, typed row, move, length or photo change makes it stale. */
  let draftFileAttempt = 0;
  let draftRevision = 0;

  /** The questions the stage is currently asking, written or built-in. */
  const activeQuestions = () => custom ?? thisOrThatPacks[pack].questions;

  /** Retire the played run's photo URLs; the editor's copies stay untouched. */
  function releaseAppliedPhotos() {
    for (const photo of appliedPhotos) if (photo) URL.revokeObjectURL(photo.url);
    appliedPhotos = [];
  }

  /** Retire every editor photo and any decode still arriving. The applied run
   * owns separate URLs, so this never changes what is currently playing. */
  function clearEditorPhotos() {
    photoRows.forEach((row, index) => {
      row.run += 1;
      row.pending = false;
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = null;
      if (customPhotoAlts[index]) customPhotoAlts[index].value = "";
      if (customPhotos[index]) customPhotos[index].value = "";
      if (customPhotoStatuses[index]) customPhotoStatuses[index].textContent = "";
      renderPhotoRow(index);
    });
  }

  /** Show one row's editor state: a compact trigger, its thumbnail, the optional
   * description and a remove action. Invalid selections never reach here, so
   * whatever photo the row already had keeps its place. */
  function renderPhotoRow(index: number) {
    const photo = photoRows[index]?.photo ?? null;
    const preview = customPhotoPreviews[index];
    const pick = customPhotoPicks[index];
    const clear = customPhotoClears[index];
    const alt = customPhotoAlts[index];
    if (preview) {
      if (photo) {
        if (preview.getAttribute("src") !== photo.url) preview.src = photo.url;
        preview.hidden = false;
        preview.alt = cleanThisOrThatAlt(alt?.value) || `Photo for question ${index + 1}`;
      } else {
        preview.hidden = true;
        preview.removeAttribute("src");
        preview.alt = "";
      }
    }
    if (pick) {
      pick.textContent = photo ? "Replace photo" : "Add a photo";
      pick.setAttribute("aria-label",
        `${photo ? "Replace" : "Add"} the optional photo for question ${index + 1}`);
    }
    if (clear) clear.hidden = !photo;
    if (alt) {
      alt.disabled = !photo;
      alt.closest("label")?.toggleAttribute("hidden", !photo);
    }
  }

  /** Remove the comparison result and every count it held. The prior picks are
   * separate: they live only while one exact replay is still being offered. */
  function clearComparisonResult() {
    if (compareResult) compareResult.hidden = true;
    if (compareSummary) compareSummary.textContent = "";
    compareRows?.replaceChildren();
  }

  /** Drop the offer, the held prior choices and any count. Called wherever a
   * run, starter or mode changes, so a comparison cannot survive one. */
  function clearComparison() {
    comparison = null;
    comparing = false;
    if (comparePanel) comparePanel.hidden = true;
    clearComparisonResult();
  }

  /** Show the concrete counts and the small per-question breakdown. Every row
   * is one actual shared position of the same built-in starter; nothing is
   * scored and no preference is implied. */
  function renderComparison(summary: ThisOrThatComparison) {
    if (!compareResult || !compareSummary || !compareRows) return;
    if (comparePanel) comparePanel.hidden = true;
    compareSummary.textContent = summary.total === 1
      ? `Same choice on ${summary.same} of ${summary.total} question. Different choice on ${summary.different}.`
      : `Same choice on ${summary.same} of ${summary.total} questions. Different choice on ${summary.different} of ${summary.total}.`;
    compareRows.replaceChildren();
    summary.rows.forEach((row) => {
      const item = document.createElement("li");
      const prompt = document.createElement("span");
      prompt.className = "tot-compare-question";
      prompt.textContent = row.prompt;
      const answer = document.createElement("strong");
      answer.textContent = row.same
        ? `Same choice: ${row.own}`
        : `Different choices: your run picked ${row.own}; the shared result picked ${row.shared}`;
      item.append(prompt, answer);
      compareRows.append(item);
    });
    compareResult.hidden = false;
    compareSummary.focus({ preventScroll: true });
  }

  /** Count the completed replay against the held shared choices, once. The
   * prior picks are released whether or not a count was possible, so a replay,
   * a reload or a later run can never show it again. */
  function finishComparison() {
    const prior = comparison;
    comparing = false;
    comparison = null;
    if (!prior || custom || pack !== prior.pack) return;
    if (picks.length !== prior.picks.length) return;
    const summary = compareThisOrThatChoices(prior.picks, picks, thisOrThatPacks[prior.pack].questions);
    if (summary) renderComparison(summary);
  }

  /** Swapping starters only retexts the panels it will ask: one controller, the
   * same choice, undo, focus and replay behaviour, no second quiz. */
  function applyPack(next: ThisOrThatPack) {
    clearComparison();
    custom = null;
    releaseAppliedPhotos();
    pack = next;
    const selected = thisOrThatPacks[pack];
    packSelect.value = pack;
    if (description) description.textContent = selected.description;
    retextPanels(selected.questions);
    heading = selected.title;
  }

  function retextPanels(
    questions: readonly (readonly [string, string, string])[],
    photos: readonly (ThisOrThatPromptPhoto | null)[] = [],
  ) {
    panels.forEach((panel, index) => {
      const photo = panel.querySelector<HTMLImageElement>("[data-tot-question-photo]");
      const question = questions[index];
      // Panels beyond this run — the wider draft tail during any shorter run —
      // stay hidden with whatever text they hold until a longer run retexts them.
      // Their photo is dropped so no revoked editor or played URL lingers.
      if (!question) {
        if (photo) {
          photo.hidden = true;
          photo.removeAttribute("src");
          photo.alt = "";
        }
        return;
      }
      const [prompt, left, right] = question;
      panel.querySelector("h2")!.textContent = prompt;
      // The group's accessible name is authored from the maker prompt; keep it
      // in step with the h2 so a swapped starter is announced by its real question.
      panel.querySelector<HTMLElement>("[data-tot-options]")?.setAttribute("aria-label", prompt);
      const buttons = panel.querySelectorAll<HTMLButtonElement>("[data-choice]");
      buttons[0].textContent = left;
      buttons[1].textContent = right;
      if (photo) {
        const state = photos[index] ?? null;
        if (state) {
          if (photo.getAttribute("src") !== state.url) photo.src = state.url;
          photo.alt = state.alt;
          photo.hidden = false;
        } else {
          photo.hidden = true;
          photo.removeAttribute("src");
          photo.alt = "";
        }
      }
    });
  }

  /** The length selector only widens or narrows the editor. Every typed row
   * keeps its draft in both directions, nothing is validated or played here,
   * and only the last visible row stops moving down. */
  function applyLength(length: ThisOrThatLength) {
    customLength = length;
    customRows.forEach((row, index) => {
      row.hidden = index >= length;
      row.querySelector<HTMLButtonElement>('[data-tot-move="down"]')!.disabled = index === length - 1;
    });
  }

  /** One device photo onto one written question: bounded before decode, decoded
   * locally, and only then attached. A stale selection, a bad format or an
   * oversized image leaves the previous photo exactly as it was. */
  async function choosePhoto(row: DraftPhotoRow, file: File) {
    const run = ++row.run;
    row.pending = true;
    const at = () => Math.max(0, photoRows.indexOf(row));
    const say = (text: string) => {
      const status = customPhotoStatuses[at()];
      if (row.run === run && status) status.textContent = text;
    };
    try {
      let head: Uint8Array;
      try {
        head = new Uint8Array(await file.slice(0, coverHeadLimit).arrayBuffer());
      } catch {
        say(`Question ${at() + 1}: that file couldn’t be read. Pick it again.`);
        return;
      }
      if (row.run !== run) return;
      const checked = checkThisOrThatPhoto(file.size, head);
      if (!checked.ok) {
        if (checked.reason === "size") {
          say(`Question ${at() + 1}: that image is too large. Photos can be up to ${checked.limit / 1_048_576} MB.`);
        } else if (checked.reason === "format") {
          say(`Question ${at() + 1}: that file isn’t a PNG, JPEG or WebP image.`);
        } else {
          say(`Question ${at() + 1}: that image is ${checked.width.toLocaleString()} × ${checked.height.toLocaleString()} pixels. Photos can be up to ${checked.limit / 1_000_000} megapixels.`);
        }
        return;
      }
      const original = URL.createObjectURL(file);
      const source = new Image();
      source.src = original;
      let blob: Blob | null;
      try {
        await source.decode();
        if (row.run !== run) return;
        if (source.naturalWidth * source.naturalHeight > coverPixelLimit) {
          say(`Question ${at() + 1}: that image is too large to show here. Try a smaller copy.`);
          return;
        }
        const scale = Math.min(1, coverWorkingMax / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image preparation unavailable");
        context.imageSmoothingQuality = "high";
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      } catch {
        say(`Question ${at() + 1}: that image couldn’t be prepared. Try a PNG, JPEG or WebP copy.`);
        return;
      } finally {
        source.removeAttribute("src");
        URL.revokeObjectURL(original);
      }
      if (row.run !== run) return;
      if (!blob) {
        say(`Question ${at() + 1}: that image couldn’t be prepared. Try a smaller copy.`);
        return;
      }
      const url = URL.createObjectURL(blob);
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = { url, blob };
      const index = at();
      const alt = customPhotoAlts[index];
      if (alt) alt.value = "";
      renderPhotoRow(index);
      say(`Question ${index + 1} has a photo. It stays in this tab and isn’t drawn into the result image.`);
    } finally {
      if (row.run === run) row.pending = false;
    }
  }

  const answered = () => picks.filter((pick) => pick !== null).length;

  function syncProgress() {
    const state = thisOrThatProgress(picks);
    progress.textContent = thisOrThatComplete(picks, activeQuestions().length)
      ? `All ${state.total} chosen`
      : `Question ${state.question} of ${state.total}`;
  }

  /** The reveal lists every exact selection next to its question. */
  function renderReveal() {
    revealTitle.textContent = heading;
    revealPicks.replaceChildren();
    activeQuestions().forEach(([prompt, left, right], index) => {
      const item = document.createElement("li");
      const ask = document.createElement("span");
      ask.className = "tot-pick-question";
      ask.textContent = prompt;
      const answer = document.createElement("strong");
      answer.textContent = picks[index] === 0 ? left : right;
      item.append(ask, answer);
      revealPicks.append(item);
    });
  }

  /** A blank offer belongs to a built-in starter only; a written five never
   * produces a link. Any visible clipboard fallback is cleared as the stage
   * moves on, so it never lingers beside a different run. */
  function clearBlankOffer() {
    blankCopyAttempt += 1;
    blank.hidden = custom !== null;
    blankManual.hidden = true;
    blankManual.value = "";
    blankStatus.textContent = "";
  }

  function showQuestion(index: number, focus = true) {
    panels.forEach((panel, at) => { panel.hidden = at !== index; });
    result.hidden = true;
    restart.hidden = true;
    clearComparisonResult();
    clearBlankOffer();
    syncProgress();
    undo.disabled = answered() === 0;
    if (focus) panels[index].querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }

  function showReveal(focus: boolean) {
    panels.forEach((panel) => { panel.hidden = true; });
    result.hidden = false;
    restart.hidden = false;
    blank.hidden = custom !== null;
    syncProgress();
    undo.disabled = false;
    renderReveal();
    // The written set has no link to hand over; the note points at the text-only
    // download instead, and says plainly that photos stay in the tab.
    if (revealNote) revealNote.textContent = custom
      ? "Every answer is yours — download the text-only result image to keep it. Your own questions and photos never become a link."
      : revealNoteBuiltin;
    if (focus) revealTitle.focus({ preventScroll: true });
  }

  function advance(focus: boolean) {
    if (thisOrThatComplete(picks, activeQuestions().length)) {
      showReveal(focus);
      if (comparing) finishComparison();
    } else showQuestion(thisOrThatProgress(picks).question - 1, focus);
    update();
  }

  elements<HTMLButtonElement>(root, "[data-choice]").forEach((button) => {
    const index = panels.indexOf(button.closest<HTMLElement>("[data-question]")!);
    const side = button.dataset.choice === "1" ? 1 : 0;
    button.addEventListener("click", (event) => {
      if (event.detail > 1) return;
      const next = pickThisOrThat(picks, index, side);
      // A stale view or a double tap changes nothing; the current question owns the pick.
      if (!next) return;
      picks = next;
      advance(true);
    });
  });

  // One native selector swaps the prompts in place. It never changes the
  // starter on first load, and replay keeps whichever starter is on screen.
  // "Your own questions" plays whatever the editor holds right now; an
  // unusable editor keeps the built-in starter and points at the row to fix.
  packSelect.addEventListener("change", () => {
    if (packSelect.value === "custom") {
      packSelect.value = custom ? "custom" : pack;
      customPanel.open = true;
      customPrompts[0]?.focus();
      return;
    }
    custom = null;
    picks = thisOrThatStart();
    applyPack(restoreThisOrThatPack(packSelect.value));
    showQuestion(0, false);
    update();
  });

  // The length selector edits only the editor: five, nine or eleven rows, every
  // typed row keeps its draft in both directions, and nothing validates or plays
  // until "Play my questions" says so.
  lengthSelect.addEventListener("change", () => {
    applyLength(restoreThisOrThatLength(lengthSelect.value));
    draftRevision += 1;
    customStatus.textContent = `Editing ${customLength} questions. Everything you typed is kept.`;
  });

  // Every typed row outranks a local draft read that is still arriving.
  for (const input of [...customPrompts, ...customLefts, ...customRights]) {
    input.addEventListener("input", () => { draftRevision += 1; });
  }

  // One optional photo per written question. The trigger opens the native
  // picker, the file is checked before any decode, and a bad pick leaves the
  // row's previous photo exactly as it was.
  customPhotoPicks.forEach((button, index) => {
    button.addEventListener("click", () => {
      photoPickRevisions[index] = draftRevision;
      customPhotos[index]?.click();
    });
  });
  customPhotos.forEach((input, index) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      const row = photoRows[index];
      const pickedAt = photoPickRevisions[index];
      photoPickRevisions[index] = undefined;
      if (!file || !row) return;
      if (pickedAt !== undefined && pickedAt !== draftRevision) {
        if (customPhotoStatuses[index]) {
          customPhotoStatuses[index].textContent = `Question ${index + 1}: the draft changed while the photo picker was open. Pick the photo again.`;
        }
        return;
      }
      draftRevision += 1;
      void choosePhoto(row, file);
    });
  });
  customPhotoClears.forEach((button, index) => {
    button.addEventListener("click", () => {
      const row = photoRows[index];
      if (!row) return;
      row.run += 1; // a decode still arriving must not undo this clear
      row.pending = false;
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = null;
      const alt = customPhotoAlts[index];
      if (alt) alt.value = "";
      if (customPhotoStatuses[index]) {
        customPhotoStatuses[index].textContent = `Photo removed from question ${index + 1}.`;
      }
      draftRevision += 1;
      renderPhotoRow(index);
      customPhotoPicks[index]?.focus({ preventScroll: true });
    });
  });
  customPhotoAlts.forEach((alt, index) => {
    alt.addEventListener("input", () => {
      draftRevision += 1;
      renderPhotoRow(index);
    });
  });
  photoRows.forEach((_, index) => renderPhotoRow(index));

  // Left and right arrows choose a side to focus; Enter or Space picks it.
  elements<HTMLElement>(root, "[data-tot-options]").forEach((group) => {
    const options = Array.from(group.querySelectorAll<HTMLButtonElement>("[data-choice]"));
    group.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      options[event.key === "ArrowLeft" ? 0 : 1]?.focus();
    });
  });

  undo.addEventListener("click", () => {
    const next = undoThisOrThat(picks);
    if (!next) return;
    picks = next;
    showQuestion(answered());
    update();
  });

  // The blank link hands over the same preset with none of this run's answers:
  // the canonical path and, for a non-maker starter, one exact pack parameter.
  // No fragment, result, byline, answers or other query travels. A written set
  // has no link at all, so its reveal never offers this action.
  blankCopy.addEventListener("click", async () => {
    if (custom || result.hidden) return;
    const href = new URL(thisOrThatBlankLink(pack), location.origin).href;
    clearBlankOffer();
    const attempt = blankCopyAttempt;
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = "Blank starter link copied. It opens this preset with no answers.";
    } catch {
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = "Clipboard access was denied. Copy the blank link from this field.";
      blankManual.value = href;
      blankManual.hidden = false;
      blankManual.focus();
      blankManual.select();
    }
  });

  // The comparison is an explicit, local replay of the exact shared built-in
  // starter. It holds the validated prior choices only in this tab, clears any
  // untouched byline that belonged to the shared result, and never reads the
  // custom editor, writes storage or changes the address.
  compareButton?.addEventListener("click", () => {
    const prior = comparison;
    if (!prior || custom || result.hidden) return;
    dropSharedByline();
    picks = thisOrThatStart();
    applyPack(prior.pack);
    comparison = prior;
    comparing = true;
    showQuestion(0, false);
    panels[0].querySelector<HTMLButtonElement>("[data-choice]")?.focus({ preventScroll: true });
    update();
  });

  restart.addEventListener("click", () => {
    // Replay is a fresh run: it never inherits a comparison or its counts.
    clearComparison();
    // Replay keeps the run on stage: a written eleven replays eleven questions,
    // a written nine replays nine, and a written five or built-in replays five.
    picks = thisOrThatStart(activeQuestions().length);
    heading = custom ? customThisOrThatTitle : thisOrThatPacks[pack].title;
    showQuestion(0, false);
    panels[0].querySelector<HTMLButtonElement>("[data-choice]")?.focus({ preventScroll: true });
    update();
  });

  /** Freeze the editor's current photos into the run that is about to play.
   * Each played photo gets its own object URL, so a later editor replacement or
   * clear cannot revoke what the active run is showing. */
  function makeAppliedPhotos(count: number): (ThisOrThatPromptPhoto | null)[] | null {
    const raw: (ThisOrThatPromptPhoto | null)[] = [];
    try {
      for (let index = 0; index < count; index += 1) {
        const photo = photoRows[index]?.photo;
        raw.push(photo
          ? { url: URL.createObjectURL(photo.blob), alt: customPhotoAlts[index]?.value ?? "" }
          : null);
      }
    } catch {
      for (const photo of raw) if (photo) URL.revokeObjectURL(photo.url);
      return null;
    }
    return freezeThisOrThatPhotos(raw, count);
  }

  /** A written set plays only through this action, which freezes the editor's
   * current question text and photos for the run. */
  function playCustom(): boolean {
    const rows = customPrompts.map((prompt, index) =>
      [prompt.value, customLefts[index]?.value, customRights[index]?.value] as const);
    const read = readThisOrThatCustom(rows, customLength);
    if (!read.questions) {
      const row = read.gap + 1;
      customStatus.textContent = read.reason === "same"
        ? `Question ${row} needs two different options.`
        : `Question ${row} needs a prompt and two options.`;
      customPanel.open = true;
      const focusRow = [customPrompts[read.gap], customLefts[read.gap], customRights[read.gap]];
      (focusRow.find((input) => input && !input.value.trim()) ?? customLefts[read.gap])?.focus();
      return false;
    }
    const photos = makeAppliedPhotos(customLength);
    if (!photos) {
      customStatus.textContent = "This browser couldn’t prepare those photos. Try again, or play without them.";
      return false;
    }
    releaseAppliedPhotos();
    appliedPhotos = photos;
    clearComparison();
    custom = read.questions;
    picks = thisOrThatStart(customLength);
    heading = customThisOrThatTitle;
    packSelect.value = "custom";
    if (description) description.textContent = "You’re playing your own questions and photos. They stay in this tab.";
    retextPanels(custom, appliedPhotos);
    showQuestion(0, false);
    panels[0].querySelector<HTMLButtonElement>("[data-choice]")?.focus();
    customPanel.open = false;
    customStatus.textContent = "";
    update();
    return true;
  }

  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    playCustom();
  });

  /** The file always carries all eleven rows, not only the visible length. */
  const draftRows = () => customPrompts.map((prompt, index) =>
    [prompt.value, customLefts[index]?.value, customRights[index]?.value] as const);

  function hasEditorContent(): boolean {
    return [...customPrompts, ...customLefts, ...customRights, ...customPhotoAlts]
      .some((input) => input.value !== "")
      || photoRows.some((row) => row.photo !== null || row.pending);
  }

  function draftFileProblem(read: ThisOrThatDraftFileRead): string {
    const unchanged = " Your editor and current run are unchanged.";
    if (read.fault === "oversized") return `That question draft is larger than ${Math.round(thisOrThatDraftFileLimit / 1024)} KB.${unchanged}`;
    if (read.fault === "unreadable") return `That file is not valid JSON.${unchanged}`;
    if (read.fault === "schema") return `That is not a Composer This or That question draft.${unchanged}`;
    if (read.fault === "version") return `That question draft uses a format this page does not know. Save a fresh one here, then open that.${unchanged}`;
    if (read.fault === "shape") return `That file must hold exactly nine v1 rows or eleven v2 rows, each with three texts, and no other fields.${unchanged}`;
    if (read.fault === "length") return `That draft’s active length must be five, nine or eleven; a v1 draft accepts five or nine.${unchanged}`;
    if (read.fault === "long") {
      const field = read.field === "left" ? "first option" : read.field === "right" ? "second option" : "prompt";
      const limit = field === "prompt" ? customThisOrThatPromptLimit : customThisOrThatOptionLimit;
      return `Question ${read.gap + 1}’s ${field} is longer than ${limit} characters.${unchanged}`;
    }
    return `That question draft could not be opened.${unchanged}`;
  }

  /** Save writes every editor row and the active length to one bounded local
   * file. Blank rows survive; picks, photos and the applied run have no field. */
  function saveQuestionDraft() {
    const text = writeThisOrThatDraftFile(draftRows(), customLength);
    if (!text) {
      draftFileStatus.textContent = "This draft could not be saved. Check that all eleven rows fit the prompt and option limits.";
      return;
    }
    // Read the exact bytes back before download, so the file has the same owned
    // shape and bounds the open handler accepts.
    if (!readThisOrThatDraftFile(text).draft) {
      draftFileStatus.textContent = "This draft is too large for one file. Shorten the question text, then save again.";
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = thisOrThatDraftFileName;
      link.rel = "noopener";
      link.click();
    } catch {
      draftFileStatus.textContent = "This browser didn’t start the download. Your editor and current run are unchanged; try again.";
      return;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    draftFileStatus.textContent = "Question draft ready. It holds all eleven rows, including hidden and blank rows — no picks or photos.";
  }

  /** Opening replaces only the editor. A valid file is confirmed first when
   * any row or photo work exists, then editor photos and pickups are retired.
   * The frozen run, its picks and its separate photo URLs are never touched. */
  draftFileInput.addEventListener("change", async () => {
    const file = draftFileInput.files?.[0];
    if (!file) return;
    const attempt = ++draftFileAttempt;
    const revision = draftRevision;
    try {
      // Refuse a runaway file before reading or parsing any of it.
      if (!Number.isFinite(file.size) || file.size > thisOrThatDraftFileLimit) {
        draftFileStatus.textContent = `That question draft is larger than ${Math.round(thisOrThatDraftFileLimit / 1024)} KB. Your editor and current run are unchanged.`;
        return;
      }
      const text = await file.text();
      if (attempt !== draftFileAttempt) return;
      if (revision !== draftRevision) {
        draftFileStatus.textContent = "The question draft arrived after you changed the editor. Open it again to replace your draft.";
        return;
      }
      const read = readThisOrThatDraftFile(text);
      const draft = read.draft;
      if (!draft) {
        draftFileStatus.textContent = draftFileProblem(read);
        return;
      }
      if (hasEditorContent() && !window.confirm(
        "Replace the question editor with this draft? Any typed rows and photos will be cleared. The run currently on stage will not change.",
      )) {
        draftFileStatus.textContent = "Open cancelled. Your editor and current run are unchanged.";
        return;
      }
      if (attempt !== draftFileAttempt || revision !== draftRevision) return;
      draft.rows.forEach((row, index) => {
        customPrompts[index].value = row[0];
        customLefts[index].value = row[1];
        customRights[index].value = row[2];
      });
      lengthSelect.value = String(draft.length);
      applyLength(draft.length);
      clearEditorPhotos();
      draftRevision += 1;
      customPanel.open = true;
      draftFileStatus.textContent = `Question draft opened for ${draft.length} questions. Review all eleven rows, then choose Play my questions. Your current run is unchanged.`;
      customPrompts[0]?.focus({ preventScroll: true });
    } catch {
      if (attempt !== draftFileAttempt) return;
      draftFileStatus.textContent = "That file could not be read on this device. Your editor and current run are unchanged.";
    } finally {
      if (attempt === draftFileAttempt) draftFileInput.value = "";
    }
  });

  draftFileSave.addEventListener("click", saveQuestionDraft);

  // Row moves edit only the draft in the inputs, and never leave the length
  // being edited. Each photo draft and its description travel with the whole
  // row; the stage, its picks, any applied set and the starter links stay
  // exactly as they are until "Play my questions".
  customRows.forEach((row, index) => {
    row.querySelectorAll<HTMLButtonElement>("[data-tot-move]").forEach((button) => {
      button.addEventListener("click", () => {
        const step = button.dataset.totMove === "up" ? -1 : 1;
        const to = index + step;
        // A hidden draft row is never swapped into, so its typed text keeps.
        if (to < 0 || to >= customLength) return;
        draftRevision += 1;
        const draft = customPrompts.map((prompt, at) =>
          [
            prompt.value,
            customLefts[at].value,
            customRights[at].value,
            photoRows[at],
            customPhotoAlts[at]?.value ?? "",
          ] as const);
        moveThisOrThatCustom(draft, index, step, customLength).forEach((draftRow, at) => {
          customPrompts[at].value = draftRow[0];
          customLefts[at].value = draftRow[1];
          customRights[at].value = draftRow[2];
          photoRows[at] = draftRow[3];
          if (customPhotoAlts[at]) customPhotoAlts[at].value = draftRow[4];
        });
        // File inputs are only triggers; their rows now carry the swapped state.
        customPhotos.forEach((input) => { input.value = ""; });
        if (customPhotoStatuses[index]) customPhotoStatuses[index].textContent = "";
        if (customPhotoStatuses[to]) customPhotoStatuses[to].textContent = "";
        renderPhotoRow(index);
        renderPhotoRow(to);
        customPrompts[to].focus({ preventScroll: true });
        customStatus.textContent = `Question ${index + 1} moved ${step < 0 ? "up" : "down"} to ${to + 1}.`;
      });
    });
  });

  // A blank link may name one exact built-in starter for a fresh signed-out
  // visitor. A shared result fragment still restores its own picks and pack
  // after this first-load hint, so the fragment keeps precedence.
  applyPack(thisOrThatPackFromQuery(location.search));
  showQuestion(0, false);

  // Leave no photo object URLs behind on a real unload. A bfcache visit keeps
  // them alive so a restored tab still shows what it did before.
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    releaseAppliedPhotos();
    photoRows.forEach((row) => {
      row.run += 1;
      row.pending = false;
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = null;
    });
  });

  return {
    result: () => {
      const summary = thisOrThatSummary(picks, activeQuestions(), heading);
      // The PNG lists the exact chosen texts of the run on stage — five for a
      // built-in starter, five/nine/eleven for a written set — as rows; sides
      // and the starter travel in the link only for built-ins. Image marking is
      // Bingo-only, and a written set carries no pack at all — it never travels
      // in a link, so prompts and answers stay in this tab.
      return summary
        ? { title: heading, items: [...summary.items], marked: [...summary.sides], ...(custom ? {} : { pack }) }
        : null;
    },
    linksAllowed: () => custom === null,
    activate() {
      // The stage buttons, starter selector and custom submit ship disabled in
      // markup so a held first tap cannot land before this mount, the requested
      // pack and any shared result are in place. This is the one ordinary entry
      // that releases them; Undo, row moves and reveal states keep their own
      // independent disabled logic.
      packSelect.disabled = false;
      customForm.querySelector<HTMLButtonElement>("[type=submit]")!.disabled = false;
      draftFileSave.disabled = false;
      draftFileInput.disabled = false;
      for (const button of elements<HTMLButtonElement>(root, "[data-choice]")) {
        button.disabled = false;
      }
    },
    restore(snapshot) {
      const sides = restoreThisOrThatPicks(snapshot.marked);
      const title = entry(snapshot.title, 72);
      if (!sides || !title) return;
      // Only one complete, known built-in five can offer the local comparison.
      const offer = readThisOrThatComparisonOffer(snapshot.marked, snapshot.pack);
      applyPack(restoreThisOrThatPack(snapshot.pack));
      picks = sides;
      heading = title;
      clearComparisonResult();
      comparison = offer;
      if (comparePanel) comparePanel.hidden = !offer;
      showReveal(false);
    },
  };
}

function mountTwentyQuestions(root: HTMLElement, update: () => void): Controller {
  const stage = root.querySelector<HTMLElement>("[data-tq-stage]")!;
  const prompt = stage.querySelector<HTMLElement>("[data-tq-prompt]")!;
  const answer = root.querySelector<HTMLInputElement>("[data-tq-answer]")!;
  const back = root.querySelector<HTMLButtonElement>("[data-tq-back]")!;
  const skip = root.querySelector<HTMLButtonElement>("[data-tq-skip]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-tq-next]")!;
  const progress = root.querySelector<HTMLElement>("[data-tq-progress]")!;
  const done = root.querySelector<HTMLElement>("[data-tq-done]")!;
  const doneNote = root.querySelector<HTMLElement>("[data-tq-done-note]")!;
  const doneHeading = done.querySelector<HTMLElement>("h2")!;
  const backFromDone = root.querySelector<HTMLButtonElement>("[data-tq-back-from-done]")!;
  const summary = root.querySelector<HTMLElement>("[data-tq-summary]")!;
  const summaryTitle = summary.querySelector<HTMLElement>("[data-tq-summary-title]")!;
  const list = summary.querySelector<HTMLElement>("[data-tq-list]")!;
  const empty = summary.querySelector<HTMLElement>("[data-tq-empty]")!;
  const resume = root.querySelector<HTMLButtonElement>("[data-tq-resume]")!;
  // The private summary's text copy: one gesture writes the exact ordered
  // pairs; a denied write offers the same text in a selected readonly field.
  const copyAnswers = root.querySelector<HTMLButtonElement>("[data-tq-copy-answers]")!;
  const copyAnswersManual = root.querySelector<HTMLTextAreaElement>("[data-tq-copy-answers-manual]")!;
  const copyAnswersStatus = root.querySelector<HTMLElement>("[data-tq-copy-answers-status]")!;
  // The local text-file export sits beside the copy, with the same gating.
  const saveAnswers = root.querySelector<HTMLButtonElement>("[data-tq-save-answers]")!;
  const saveAnswersStatus = root.querySelector<HTMLElement>("[data-tq-save-answers-status]")!;
  let copyAnswersAttempt = 0;
  let copyingAnswers = false;
  // One invite action for the built-in game, wherever the summary is shown.
  const blankCopy = root.querySelector<HTMLButtonElement>("[data-tq-blank-copy]")!;
  const blankManual = root.querySelector<HTMLInputElement>("[data-tq-blank-manual]")!;
  const blankNote = root.querySelector<HTMLElement>("[data-tq-blank-note]")!;
  const blankStatus = root.querySelector<HTMLElement>("[data-tq-blank-status]")!;
  const description = root.querySelector<HTMLElement>("[data-tot-description]");
  let blankCopyAttempt = 0;
  const restarts = elements<HTMLButtonElement>(root, "[data-restart]");
  const finishes = elements<HTMLButtonElement>(root, "[data-tq-finish]");
  const customPanel = root.querySelector<HTMLDetailsElement>("[data-tq-custom]")!;
  const customForm = root.querySelector<HTMLFormElement>("[data-tq-custom-form]")!;
  const customPrompts = root.querySelector<HTMLTextAreaElement>("[data-tq-custom-prompts]")!;
  const customStatus = root.querySelector<HTMLElement>("[data-tq-custom-status]")!;
  const customReset = root.querySelector<HTMLButtonElement>("[data-tq-custom-reset]")!;
  const packSelect = root.querySelector<HTMLSelectElement>("[data-tq-pack]")!;
  const packApply = root.querySelector<HTMLButtonElement>("[data-tq-pack-apply]")!;
  const promptFileSave = root.querySelector<HTMLButtonElement>("[data-tq-prompts-file-save]")!;
  const promptFileInput = root.querySelector<HTMLInputElement>("[data-tq-prompts-file]")!;
  const promptFileStatus = root.querySelector<HTMLElement>("[data-tq-prompts-file-status]")!;
  let answers = twentyOneStart();
  let current = 0;
  let view: "questions" | "done" | "summary" = "questions";
  /** A fresh invite may select one exact built-in pack. No hash ever restores
   * answers, and every other fragment keeps the original bare-route starter. */
  const initialPack = twentyOnePackFromHash(location.hash);
  /** The prompts this run asks. Only an explicit Apply, pack action or Reset
   * changes them, so the editor stays a draft and an active run is never
   * retexted mid-answer. */
  let activeQuestions: readonly string[] = twentyOnePacks[initialPack].questions;
  /** Null means a custom set. Its invitation is always the default bare URL. */
  let activePack: TwentyOnePack | null = initialPack;
  /** Whether the active set differs from either built-in starter, for the
   * quiet progress marker. */
  let authored = false;
  /** A prompt file belongs to the editor text it was picked for. A later file
   * pick, typed edit, Apply or Reset makes any slower read stale, so it can
   * never replace newer text or disturb the active run. */
  let promptFileAttempt = 0;
  let promptRevision = 0;

  /** An invite belongs to one summary view. Leaving it, replaying or applying
   * a set retires any visible fallback field and an in-flight clipboard write. */
  function clearBlankOffer() {
    blankCopyAttempt += 1;
    blankManual.hidden = true;
    blankManual.value = "";
    blankStatus.textContent = "";
  }

  /** One copy belongs to one summary view. Leaving it, answering, editing,
   * replaying, applying prompts or starting another attempt retires both the
   * status and the fallback text and strands any slower clipboard result, so
   * an earlier answer can never reappear as current. */
  function clearCopyAnswers() {
    copyAnswersAttempt += 1;
    copyingAnswers = false;
    copyAnswersManual.hidden = true;
    copyAnswersManual.value = "";
    copyAnswersStatus.textContent = "";
    saveAnswersStatus.textContent = "";
  }

  function syncStarterEditor() {
    const selected = restoreTwentyOnePack(packSelect.value);
    packApply.textContent = `Use ${twentyOnePacks[selected].name} and clear answers`;
  }

  function activeTitle(): string {
    return activePack ? twentyOnePacks[activePack].title : twentyOneResultTitle;
  }

  function syncDescription() {
    if (!description) return;
    description.textContent = activePack
      ? twentyOnePacks[activePack].description
      : experiences["twenty-one-questions"].description;
  }

  function syncBlankNote() {
    blankNote.textContent = activePack === null
      ? "Copies the default built-in starter. Your edited questions and answers stay in this tab."
      : activePack === twentyOneDefaultPack
      ? "Copies the built-in 21 Questions starter with no answers."
      : `Copies the ${twentyOnePacks[activePack].name} starter with no answers.`;
  }

  function syncProgress() {
    const answered = twentyOneAnswered(answers);
    const source = authored
      ? " · your prompts"
      : activePack && activePack !== twentyOneDefaultPack
      ? ` · ${twentyOnePacks[activePack].name}`
      : "";
    progress.textContent = view === "questions"
      ? `Question ${current + 1} of ${twentyOneCount} · ${answered} answered${source}`
      : view === "done"
      ? `All ${twentyOneCount} asked · ${answered} answered${source}`
      : `${answered} of ${twentyOneCount} answered${source}`;
  }

  /** One question at a time: the same stage retexted from the run’s frozen
   * prompts, so back, skip and edit are one step each and the current answer
   * is always the visible input. */
  function showQuestion(index: number, focus = true) {
    view = "questions";
    current = index;
    stage.hidden = false;
    done.hidden = true;
    summary.hidden = true;
    clearBlankOffer();
    clearCopyAnswers();
    copyAnswers.disabled = true;
    saveAnswers.disabled = true;
    const question = activeQuestions[current];
    prompt.textContent = question;
    answer.value = answers[current];
    next.textContent = current === twentyOneCount - 1 ? "Finish questions" : "Next";
    back.disabled = current === 0;
    syncProgress();
    if (focus) answer.focus();
  }

  function showDone(focus: boolean) {
    view = "done";
    stage.hidden = true;
    done.hidden = false;
    summary.hidden = true;
    clearBlankOffer();
    clearCopyAnswers();
    copyAnswers.disabled = true;
    saveAnswers.disabled = true;
    const answered = twentyOneAnswered(answers);
    doneNote.textContent = answered === 0
      ? "You skipped every question. You can still go back and answer any of them."
      : `${answered} answered · ${twentyOneCount - answered} skipped.`;
    syncProgress();
    if (focus) doneHeading.focus();
  }

  /** The complete view is always the player's own click: it lists exactly the
   * answers given, and every entry offers one-step edit back to its question. */
  function showSummary(focus: boolean) {
    view = "summary";
    stage.hidden = true;
    done.hidden = true;
    summary.hidden = false;
    clearBlankOffer();
    clearCopyAnswers();
    summaryTitle.textContent = activeTitle();
    syncBlankNote();
    list.replaceChildren();
    const pairs = twentyOnePairs(answers, activeQuestions);
    // The copy and the file save exist only when this summary has a response.
    copyAnswers.disabled = pairs.length === 0;
    saveAnswers.disabled = pairs.length === 0;
    empty.hidden = pairs.length > 0;
    for (const pair of pairs) {
      const item = document.createElement("li");
      const ask = document.createElement("span");
      ask.className = "tq-pick-question";
      ask.textContent = `${pair.index + 1}. ${pair.question}`;
      const said = document.createElement("strong");
      said.textContent = pair.answer;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit your answer to question ${pair.index + 1}`);
      edit.addEventListener("click", () => {
        showQuestion(pair.index, true);
        update();
      });
      item.append(ask, said, edit);
      list.append(item);
    }
    syncProgress();
    if (focus) summaryTitle.focus();
  }

  function advance(focus: boolean) {
    if (current === twentyOneCount - 1) showDone(focus);
    else showQuestion(moveTwentyOne(current, 1), focus);
    update();
  }

  // The input is the live answer: every keystroke stays in this screen's
  // memory only, and no draft, hash or request ever carries it away.
  answer.addEventListener("input", () => {
    const recorded = setTwentyOneAnswer(answers, current, answer.value);
    if (!recorded) return;
    answers = recorded;
    // Answering or editing supersedes any text a previous summary copied.
    clearCopyAnswers();
    syncProgress();
    update();
  });
  // Enter advances like Next, so a keyboard run is one keypress per question.
  answer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    advance(true);
  });
  next.addEventListener("click", () => advance(true));
  back.addEventListener("click", () => {
    if (current === 0) return;
    showQuestion(moveTwentyOne(current, -1), true);
    update();
  });
  skip.addEventListener("click", () => {
    const cleared = skipTwentyOne(answers, current);
    if (!cleared) return;
    answers = cleared;
    answer.value = "";
    advance(true);
  });
  finishes.forEach((button) => button.addEventListener("click", () => {
    showSummary(true);
    update();
  }));
  backFromDone.addEventListener("click", () => {
    showQuestion(twentyOneCount - 1, true);
    update();
  });
  resume.addEventListener("click", () => {
    showQuestion(current, true);
    update();
  });

  // The invite names only the built-in starter on stage. The default and any
  // custom run keep the bare route; Creative life adds only its exact pack
  // fragment. No answer, result, byline, authored prompt or saved state travels.
  blankCopy.addEventListener("click", async () => {
    if (view !== "summary") return;
    const pack = activePack;
    const href = new URL(twentyOneBlankLink(pack), location.origin).href;
    clearBlankOffer();
    const attempt = blankCopyAttempt;
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = pack === null
        ? "Default built-in starter link copied. Your edited questions and answers stay in this tab."
        : pack === twentyOneDefaultPack
        ? "Built-in starter link copied. It opens the built-in 21 questions with no answers."
        : `${twentyOnePacks[pack].name} starter link copied. It opens ${twentyOnePacks[pack].name} with no answers.`;
    } catch {
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = "Clipboard access was denied. Copy the built-in starter link from this field.";
      blankManual.value = href;
      blankManual.hidden = false;
      blankManual.focus();
      blankManual.select();
    }
  });

  // A deliberate click copies the private summary as plain text. The pairs
  // are read fresh from this run's frozen prompts and answers, so an earlier
  // attempt, a prompt draft or a result cannot change what is written.
  copyAnswers.addEventListener("click", async () => {
    if (view !== "summary" || copyAnswers.disabled || copyingAnswers) return;
    const pairs = twentyOnePairs(answers, activeQuestions);
    if (pairs.length === 0) return;
    const text = twentyOneAnswersText(pairs);
    clearCopyAnswers();
    const attempt = copyAnswersAttempt;
    copyingAnswers = true;
    try {
      await navigator.clipboard.writeText(text);
      if (attempt !== copyAnswersAttempt) return;
      copyAnswersStatus.textContent = "Answers copied. Paste them where you want to keep them.";
    } catch {
      if (attempt !== copyAnswersAttempt) return;
      copyAnswersStatus.textContent = "Clipboard access was denied. Your answers are selected below — copy them with your device’s copy shortcut.";
      copyAnswersManual.value = text;
      copyAnswersManual.hidden = false;
      copyAnswersManual.focus();
      copyAnswersManual.select();
    } finally {
      if (attempt === copyAnswersAttempt) copyingAnswers = false;
    }
  });

  restarts.forEach((button) => button.addEventListener("click", () => {
    // A replay asks the run’s active prompts again — written or built-in —
    // with fresh answers, until Reset returns to the built-in starter.
    answers = twentyOneStart();
    showQuestion(0, true);
    update();
  }));

  // One deliberate click writes the same frozen pairs the copy reads into one
  // local UTF-8 text file. The bytes never leave this device: the only URL is a
  // short-lived blob, no answer enters the page address or storage, and the
  // clipboard denial and fallback above stay exactly as they were.
  saveAnswers.addEventListener("click", () => {
    if (view !== "summary" || saveAnswers.disabled) return;
    const pairs = twentyOnePairs(answers, activeQuestions);
    if (pairs.length === 0) return;
    const text = twentyOneAnswersText(pairs);
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = twentyOneAnswersFileName;
      link.rel = "noopener";
      link.click();
    } catch {
      saveAnswersStatus.textContent = "This browser didn’t start the download. Your answers are unchanged; try again.";
      return;
    } finally {
      // Release the blob URL once the browser has had time to start the
      // download, on success or failure, so the page never leaks one.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    saveAnswersStatus.textContent = "Answers saved as a local text file.";
  });

  /** Every failure names its line and leaves the active run untouched. */
  function promptProblem(read: ReturnType<typeof readTwentyOnePrompts>): string {
    const line = read.gap + 1;
    if (read.reason === "count") {
      return `Enter exactly ${twentyOneCount} prompts, one per line. This editor has ${read.count} ${read.count === 1 ? "line" : "lines"}.`;
    }
    if (read.reason === "empty") return `Line ${line} is empty. Write a prompt on every line.`;
    if (read.reason === "long") return `Line ${line} is longer than ${twentyOnePromptLimit} characters. Shorten it to fit the card.`;
    if (read.reason === "duplicate") return `Line ${line} repeats an earlier prompt. Make all ${twentyOneCount} distinct.`;
    return "Check the 21 prompts, then apply them again.";
  }

  /** Put the caret on the exact line that needs attention. Textarea values use
   * one \n per line, so counting those offsets reaches the failing line. */
  function selectPromptLine(index: number) {
    const lines = customPrompts.value.split(/\r?\n/);
    let start = 0;
    for (let line = 0; line < index && line < lines.length; line += 1) start += lines[line].length + 1;
    customPrompts.focus();
    customPrompts.setSelectionRange(start, start + (lines[index]?.length ?? 0));
  }

  /** A written set lives only in this tab. Applying is the one action that
   * replaces the current run: the frozen prompts, a fresh answer list and the
   * same stage, with no link, draft, request or stored copy. */
  function applyPrompts(
    prompts: readonly string[],
    pack: TwentyOnePack | null = twentyOnePackForPrompts(prompts),
  ) {
    // Applying, switching or resetting retires a previous run's copied text as
    // well as any prompt file still being read, then deliberately clears every
    // answer for the fresh run.
    clearCopyAnswers();
    promptRevision += 1;
    activeQuestions = [...prompts];
    activePack = pack;
    authored = activePack === null;
    packSelect.value = activePack ?? twentyOneDefaultPack;
    syncStarterEditor();
    syncDescription();
    customPrompts.value = activeQuestions.join("\n");
    answers = twentyOneStart();
    customPanel.open = false;
    customStatus.textContent = "";
    showQuestion(0, true);
    update();
  }

  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = readTwentyOnePrompts(customPrompts.value.split(/\r?\n/));
    if (!read.prompts) {
      customStatus.textContent = promptProblem(read);
      customPanel.open = true;
      if (read.gap >= 0) selectPromptLine(read.gap);
      else customPrompts.focus();
      return;
    }
    applyPrompts(read.prompts);
  });

  customReset.addEventListener("click", () => applyPrompts(twentyOneQuestions, twentyOneDefaultPack));

  // Selection only replaces the editor draft. The active prompts, title and
  // answers stay untouched until the separately labelled clear-answers action.
  packSelect.addEventListener("change", () => {
    const selected = restoreTwentyOnePack(packSelect.value);
    const name = twentyOnePacks[selected].name;
    customPrompts.value = twentyOnePacks[selected].questions.join("\n");
    promptRevision += 1;
    promptFileStatus.textContent = "";
    syncStarterEditor();
    customStatus.textContent = `${name} is ready in the editor. Your current run and answers are unchanged. Choose “Use ${name} and clear answers” to switch.`;
  });

  packApply.addEventListener("click", () => {
    const selected = restoreTwentyOnePack(packSelect.value);
    applyPrompts(twentyOnePacks[selected].questions, selected);
  });

  /** Every refusal names the reason and keeps the editor and the current run
   * exactly as they were. No field in this file can carry an answer. */
  function promptFileProblem(read: TwentyOnePromptFileRead): string {
    const unchanged = " Your editor and current run are unchanged.";
    if (read.fault === "oversized") return `That prompt file is larger than ${Math.round(twentyOnePromptFileLimit / 1024)} KB.${unchanged}`;
    if (read.fault === "unreadable") return `That file is not valid JSON.${unchanged}`;
    if (read.fault === "schema") return `That is not a Composer 21 Questions prompt file.${unchanged}`;
    if (read.fault === "version") return `That prompt file uses a format this page does not know. Save a fresh one here, then open that.${unchanged}`;
    if (read.fault === "shape") return `That file is missing its schema or its 21 prompt texts, or carries fields this editor cannot use.${unchanged}`;
    if (read.fault === "count") return `That file does not hold exactly ${twentyOneCount} prompts.${unchanged}`;
    if (read.fault === "empty") return `Prompt ${read.gap + 1} in that file is empty.${unchanged}`;
    if (read.fault === "long") return `Prompt ${read.gap + 1} in that file is longer than ${twentyOnePromptLimit} characters.${unchanged}`;
    if (read.fault === "duplicate") return `Prompt ${read.gap + 1} in that file repeats an earlier one.${unchanged}`;
    return `That prompt file could not be opened.${unchanged}`;
  }

  /** Save writes only the validated editor text to one bounded, versioned,
   * answer-free file on this device. Nothing is stored or sent. */
  function savePromptFile() {
    const read = readTwentyOnePrompts(customPrompts.value.split(/\r?\n/));
    if (!read.prompts) {
      promptFileStatus.textContent = promptProblem(read);
      customPanel.open = true;
      if (read.gap >= 0) selectPromptLine(read.gap);
      else customPrompts.focus();
      return;
    }
    const text = writeTwentyOnePromptFile(read.prompts);
    // Read the exact bytes back first, so the download is the same bounded
    // prompt-only shape this page accepts when a file is opened.
    if (!readTwentyOnePromptFile(text).prompts) {
      promptFileStatus.textContent = "These prompts are too large for one file. Shorten them, then save again.";
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = twentyOnePromptFileName;
      link.rel = "noopener";
      link.click();
    } catch {
      promptFileStatus.textContent = "This browser didn’t start the download. Your prompts are unchanged; try again.";
      return;
    } finally {
      // Release the blob URL once the browser has had time to start the
      // download, on success or failure, so the page never leaks one.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    promptFileStatus.textContent = "Prompt file ready. It holds only your 21 prompts — no answers or result.";
  }

  /** Opening a file fills the textarea only. It never starts a run, rewrites
   * the address or touches the current answers, cards or built-in invite. */
  promptFileInput.addEventListener("change", async () => {
    const file = promptFileInput.files?.[0];
    if (!file) return;
    const attempt = ++promptFileAttempt;
    const revision = promptRevision;
    try {
      // Refuse a runaway file before reading or parsing any of it.
      if (!Number.isFinite(file.size) || file.size > twentyOnePromptFileLimit) {
        promptFileStatus.textContent = `That prompt file is larger than ${Math.round(twentyOnePromptFileLimit / 1024)} KB. Your editor and current run are unchanged.`;
        return;
      }
      const text = await file.text();
      if (attempt !== promptFileAttempt) return;
      // A read landing after a typed edit, Apply or Reset is stale: keep the
      // newer editor text and the run as they are.
      if (revision !== promptRevision) {
        promptFileStatus.textContent = "The prompt file arrived after you changed the editor. Open it again to fill the editor.";
        return;
      }
      const read = readTwentyOnePromptFile(text);
      if (!read.prompts) {
        promptFileStatus.textContent = promptFileProblem(read);
        return;
      }
      customPrompts.value = read.prompts.join("\n");
      customPanel.open = true;
      promptFileStatus.textContent = "Prompt file opened. Review the 21 prompts, then choose Apply and start fresh to use them.";
    } catch {
      if (attempt !== promptFileAttempt) return;
      promptFileStatus.textContent = "That file could not be read on this device. Your editor and current run are unchanged.";
    } finally {
      if (attempt === promptFileAttempt) promptFileInput.value = "";
    }
  });

  // Any typed edit after a file was chosen outranks a slower read.
  customPrompts.addEventListener("input", () => { promptRevision += 1; });
  promptFileSave.addEventListener("click", savePromptFile);

  packSelect.value = initialPack;
  customPrompts.value = activeQuestions.join("\n");
  syncStarterEditor();
  syncDescription();
  showQuestion(0, false);

  return {
    // The card snapshot freezes the answers and the exact ordered prompts the
    // run asked. Preview and both formats draw from this one copy.
    result: () => view !== "summary" || twentyOneAnswered(answers) === 0
      ? null
      : { title: activeTitle(), items: [...answers], questions: [...activeQuestions] },
    // Private answers never become a public link: URL sharing stays off for
    // the whole run, with the downloaded cards as the way out.
    linksAllowed: () => false,
    activate() {
      // Answer, next, skip, both finish buttons and every prompt editor action
      // ship disabled in markup: a held module must not accept an early answer
      // that this mount would then discard. This is the one ordinary entry
      // that releases them, after the handlers and initial state are ready.
      // Back keeps its own rule in showQuestion(), so question 1 stays backless.
      answer.disabled = false;
      next.disabled = false;
      skip.disabled = false;
      for (const button of finishes) button.disabled = false;
      const submit = customForm.querySelector<HTMLButtonElement>("[type=submit]");
      if (submit) submit.disabled = false;
      customPrompts.disabled = false;
      customReset.disabled = false;
      packSelect.disabled = false;
      packApply.disabled = false;
      // The prompt file controls are JavaScript-only too. Releasing them here
      // keeps one held module from leaving any of them apparently usable.
      for (const control of [promptFileSave, promptFileInput]) control.disabled = false;
    },
    restore() {
      // A crafted hash is not a shared result: nothing restores.
    },
  };
}

/** The shared “Which X are you?” player used by the Developer Type Quiz and
 * the Language Type Quiz. Answers stay in this tab; only the chosen outcome
 * name can travel in an answer-free result link. A bare route starts a fresh
 * quiz, and an unknown `#result=` value falls back to that same fresh start.
 *
 * A remix draft retexts only the visible title, prompts and four choice
 * labels. Each choice keeps its starter position and primary/secondary
 * mapping, so the same `pack.resolve()` decides the outcome. A draft run never
 * writes the address, offers a result link, reaches storage or produces the
 * published quiz's result card. */
function mountPersona(root: HTMLElement, update: () => void, pack: PersonaPack): Controller {
  const stage = root.querySelector<HTMLElement>("[data-persona-question]")!;
  const prompt = root.querySelector<HTMLElement>("[data-persona-prompt]")!;
  const options = root.querySelector<HTMLElement>("[data-persona-options]")!;
  const choices = elements<HTMLButtonElement>(root, "[data-persona-choice]");
  const progress = root.querySelector<HTMLElement>("[data-persona-progress]")!;
  const back = root.querySelector<HTMLButtonElement>("[data-persona-back]")!;
  const notice = root.querySelector<HTMLElement>("[data-persona-notice]")!;
  const result = root.querySelector<HTMLElement>("[data-persona-result]")!;
  const archetype = root.querySelector<HTMLElement>("[data-persona-archetype]")!;
  const service = root.querySelector<HTMLElement>("[data-persona-service]")!;
  const tendency = root.querySelector<HTMLElement>("[data-persona-tendency]")!;
  const reason = root.querySelector<HTMLElement>("[data-persona-reason]")!;
  const docs = root.querySelector<HTMLAnchorElement>("[data-persona-docs]")!;
  const retake = root.querySelector<HTMLButtonElement>("[data-persona-retake]")!;
  const revise = root.querySelector<HTMLButtonElement>("[data-persona-revise]")!;
  const fresh = root.querySelector<HTMLAnchorElement>("[data-persona-fresh]")!;
  const linkWrap = root.querySelector<HTMLElement>("[data-persona-link-panel]")!;
  const link = root.querySelector<HTMLInputElement>("[data-persona-link]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-persona-copy]")!;
  const copyStatus = root.querySelector<HTMLElement>("[data-persona-status]")!;
  const captionCopy = root.querySelector<HTMLButtonElement>("[data-persona-caption-copy]")!;
  const captionManual = root.querySelector<HTMLTextAreaElement>("[data-persona-caption-manual]")!;
  const captionStatus = root.querySelector<HTMLElement>("[data-persona-caption-status]")!;
  /** Retire any caption fallback from an earlier result or a draft. */
  const clearCaption = () => {
    captionStatus.textContent = "";
    captionManual.hidden = true;
    captionManual.value = "";
  };
  const draftNote = root.querySelector<HTMLElement>("[data-persona-draft-note]")!;
  const remix = root.querySelector<HTMLDetailsElement>("[data-persona-remix]")!;
  const remixForm = root.querySelector<HTMLFormElement>("[data-persona-draft-form]")!;
  const draftTitle = root.querySelector<HTMLInputElement>("[data-persona-draft-title]")!;
  const draftPrompts = elements<HTMLInputElement>(root, "[data-persona-draft-prompt]");
  const draftOptions = elements<HTMLInputElement>(root, "[data-persona-draft-option]");
  const draftOutcomeInputs = elements<HTMLInputElement>(root, "[data-persona-draft-outcome]");
  const draftOutcomeIds = pack.ids;
  const draftStatus = root.querySelector<HTMLElement>("[data-persona-draft-status]")!;
  const draftSave = root.querySelector<HTMLButtonElement>("[data-persona-draft-save]")!;
  const draftFile = root.querySelector<HTMLInputElement>("[data-persona-draft-file]")!;
  const draftFileStatus = root.querySelector<HTMLElement>("[data-persona-draft-file-status]")!;
  const draftActive = root.querySelector<HTMLElement>("[data-persona-draft-active]")!;
  const draftActiveNote = root.querySelector<HTMLElement>("[data-persona-draft-active-note]")!;
  const draftEdit = root.querySelector<HTMLButtonElement>("[data-persona-draft-edit]")!;
  const draftOriginal = root.querySelector<HTMLButtonElement>("[data-persona-draft-original]")!;
  let answers: (number | null)[] = pack.questions.map(() => null);
  let current = 0;
  let shown: string | null = null;
  /** The validated local draft on stage, or null for the published quiz. */
  let draft: PersonaDraft | null = null;
  /** Bumped by every typed editor change, so a slow file read cannot replace
   * text the creator changed after choosing the file. */
  let editorRevision = 0;
  /** Identifies the newest file read; an older read never lands. */
  let fileAttempt = 0;
  const draftFileLimit = `${Math.round(personaDraftFileLimit / 1024)} KB`;
  // The outer share bar calls update() once after this controller is built.
  // Events before that point cannot fire, so later stage changes can refresh it.
  let ready = false;

  const replaceAddress = (path: string) => {
    try { history.replaceState(null, "", path); } catch { /* A blocked history still plays. */ }
  };

  /** The prompt and four labels the stage should show. A draft keeps the
   * starter's option order, so index 0–3 still means the same mapping. */
  const questionAt = (index: number) => draft
    ? draft.questions[index]
    : {
      prompt: pack.questions[index].prompt,
      options: pack.questions[index].options.map((option) => option.label),
    };

  function syncQuestionProgress() {
    const answered = answers.filter((answer) => answer !== null).length;
    progress.textContent = `Question ${current + 1} of ${pack.questionCount} · ${answered} answered`;
  }

  function showQuestion(index: number, focus = true) {
    current = index;
    shown = null;
    const question = questionAt(index);
    stage.hidden = false;
    result.hidden = true;
    remix.hidden = draft !== null;
    prompt.textContent = question.prompt;
    choices.forEach((button, choice) => {
      button.textContent = question.options[choice];
      button.setAttribute("aria-pressed", String(answers[index] === choice));
    });
    back.disabled = index === 0;
    syncQuestionProgress();
    if (focus) prompt.focus();
    if (ready) update();
  }

  function showResult(id: string, shared = false) {
    const outcome = pack.outcome(id);
    if (!outcome) return;
    const remixActive = draft !== null;
    shown = id;
    notice.textContent = "";
    stage.hidden = true;
    result.hidden = false;
    // A shared result is read-only: the remix editor belongs to a fresh run,
    // so a draft can never start while someone else's result fragment is open.
    remix.hidden = shared || remixActive;
    archetype.textContent = draft?.outcomes?.[id] || outcome.archetype;
    service.textContent = outcome.subject;
    tendency.textContent = outcome.tendency;
    reason.textContent = outcome.reason;
    docs.href = outcome.href;
    docs.textContent = outcome.docsText;
    docs.setAttribute("aria-label", outcome.docsAria);
    // A draft result is local: no result address is written or shown, and the
    // published card never stands in for a remixed quiz.
    linkWrap.hidden = remixActive;
    draftNote.hidden = !remixActive;
    link.value = remixActive ? "" : new URL(pack.resultPath(id), location.origin).href;
    copyStatus.textContent = "";
    clearCaption();
    retake.hidden = shared;
    revise.hidden = shared || answers.some((answer) => answer === null);
    fresh.hidden = remixActive || !shared;
    retake.textContent = remixActive ? "Play draft again" : "Play again";
    progress.textContent = remixActive
      ? `All ${pack.questionCount} answered · draft result`
      : shared
        ? "Shared result"
        : `All ${pack.questionCount} answered · your result`;
    archetype.focus();
    if (ready) update();
  }

  function resetRun() {
    answers = pack.questions.map(() => null);
    notice.textContent = "";
    if (!draft) replaceAddress(pack.path);
    showQuestion(0, true);
  }

  /** One honest message for the first unusable draft field. */
  function draftGapMessage(gap: PersonaDraftGap | null): string {
    if (!gap) return "";
    if (gap.field === "title") return "Give the draft a title before playing.";
    if (gap.field === "prompt") return `Question ${gap.question + 1} needs a prompt.`;
    if (gap.reason === "duplicate") {
      return `Question ${gap.question + 1}, choice ${gap.option + 1} repeats another choice. Give each choice its own label.`;
    }
    return `Question ${gap.question + 1}, choice ${gap.option + 1} needs a label.`;
  }

  function focusDraftGap(gap: PersonaDraftGap | null) {
    remix.open = true;
    if (!gap || gap.field === "title") {
      draftTitle.focus();
      return;
    }
    if (gap.field === "prompt") {
      draftPrompts[gap.question]?.focus();
      return;
    }
    draftOptions[gap.question * 4 + gap.option]?.focus();
  }

  /** Read the editor rows exactly as typed. */
  const editorRows = () => draftPrompts.map((promptInput, index) => [
    promptInput.value,
    ...draftOptions.slice(index * 4, index * 4 + 4).map((input) => input.value),
  ]);

  /** Read each optional name against the trusted outcome ID rendered beside
   * it, so the stable mapping can never move with the typed text. */
  const editorOutcomes = () => draftOutcomeInputs.map((input, index) => ({
    id: draftOutcomeIds[index] ?? "",
    label: input.value,
  }));

  /** Put exactly the validated, cleaned draft text back in the editor. */
  function fillDraftEditor(next: PersonaDraft) {
    draftTitle.value = next.title;
    draftOutcomeInputs.forEach((input, index) => {
      const id = draftOutcomeIds[index];
      input.value = id ? next.outcomes?.[id] ?? "" : "";
    });
    next.questions.forEach((question, index) => {
      const promptInput = draftPrompts[index];
      if (promptInput) promptInput.value = question.prompt;
      question.options.forEach((label, choice) => {
        const optionInput = draftOptions[index * 4 + choice];
        if (optionInput) optionInput.value = label;
      });
    });
  }

  /** Validate the editor text and put exactly that cleaned text on stage. The
   * draft supplies labels only; scoring still uses the pack's fixed mappings. */
  function startDraft() {
    const read = readPersonaDraft(draftTitle.value, editorRows(), pack.questions.length, editorOutcomes());
    if (!read.draft) {
      draftStatus.textContent = draftGapMessage(read.gap);
      focusDraftGap(read.gap);
      return;
    }
    // What plays is the trimmed, single-spaced text the creator now sees.
    fileAttempt += 1;
    draftFile.value = "";
    draftFileStatus.textContent = "";
    fillDraftEditor(read.draft);
    draft = read.draft;
    answers = pack.questions.map(() => null);
    shown = null;
    link.value = "";
    copyStatus.textContent = "";
    clearCaption();
    draftStatus.textContent = "";
    remix.hidden = true;
    remix.open = false;
    draftActive.hidden = false;
    draftEdit.hidden = false;
    draftActiveNote.textContent = `Playing “${draft.title}”.`;
    showQuestion(0, true);
  }

  /** Leave the stage without losing a single typed draft value. */
  function editDraft() {
    if (!draft) return;
    remix.hidden = false;
    remix.open = true;
    draftActive.hidden = false;
    draftEdit.hidden = true;
    stage.hidden = true;
    result.hidden = true;
    progress.textContent = "Editing your draft";
    draftActiveNote.textContent = `Editing “${draftTitle.value || draft.title}”. Playing the draft starts at question 1.`;
    draftStatus.textContent = "";
    draftTitle.focus();
    update();
  }

  /** Cancel the remix and start the published quiz cleanly. The editor keeps
   * its text, but the address, answers, result link and card are the original. */
  function returnToOriginal() {
    fileAttempt += 1;
    draftFile.value = "";
    draftFileStatus.textContent = "";
    draft = null;
    shown = null;
    answers = pack.questions.map(() => null);
    notice.textContent = "";
    draftActive.hidden = true;
    draftActiveNote.textContent = "";
    draftEdit.hidden = false;
    remix.hidden = false;
    remix.open = false;
    draftNote.hidden = true;
    linkWrap.hidden = false;
    link.value = "";
    copyStatus.textContent = "";
    clearCaption();
    retake.textContent = "Play again";
    replaceAddress(pack.path);
    showQuestion(0, true);
    draftStatus.textContent = "Original quiz restored. Your draft text is still in the editor.";
  }

  /** One honest message for the first reason a portable file cannot be used. */
  function draftFileProblem(read: PersonaDraftFileRead): string {
    if (read.fault === "oversized") {
      return `That draft file is larger than ${draftFileLimit}. Your editor is unchanged.`;
    }
    if (read.fault === "unreadable") return "That file is not valid JSON. Your editor is unchanged.";
    if (read.fault === "version") {
      return "That draft uses a format this quiz page does not know. Save a fresh draft here, then open that file. Your editor is unchanged.";
    }
    if (read.fault === "pack") {
      return "That draft belongs to a different quiz. Open it on that quiz’s page. Your editor is unchanged.";
    }
    if (read.fault === "schema") return "That is not a Composer quiz draft. Your editor is unchanged.";
    if (read.fault === "outcome") {
      return "That draft names a result this quiz does not have. Your editor is unchanged.";
    }
    if (read.fault === "shape") {
      return "That draft is missing its pack, title, questions or four choice labels. Your editor is unchanged.";
    }
    if (read.gap) {
      return `That draft needs attention before it can play. ${draftGapMessage(read.gap)} Your editor is unchanged.`;
    }
    return "That draft could not be opened. Your editor is unchanged.";
  }

  /** Save deliberately writes the validated visible text to one bounded,
   * versioned JSON file on the creator's device. Nothing is stored or sent. */
  function saveDraftFile() {
    const read = readPersonaDraft(draftTitle.value, editorRows(), pack.questions.length, editorOutcomes());
    if (!read.draft) {
      draftFileStatus.textContent = draftGapMessage(read.gap);
      focusDraftGap(read.gap);
      return;
    }
    const text = writePersonaDraftFile(pack.game, read.draft);
    // Read the exact bytes back before handing them over, so the downloaded
    // file is the same bounded, answer-free shape an import accepts.
    const checked = readPersonaDraftFile(pack.game, text, pack.questions.length, draftOutcomeIds);
    if (!checked.draft) {
      draftFileStatus.textContent = `Shorten the draft to fit in a ${draftFileLimit} file, then save again.`;
      return;
    }
    fillDraftEditor(read.draft);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = personaDraftFileName(pack.game);
      link.rel = "noopener";
      link.click();
    } catch {
      draftFileStatus.textContent = "Couldn’t save the draft file.";
      return;
    } finally {
      // Release the blob URL once the browser has had time to start the
      // download, on success or failure, so the page never leaks one.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    draftFileStatus.textContent = "Draft JSON ready to download.";
  }

  /** Opening a file fills the editor's text only. It never starts a run,
   * rewrites the address or touches the published quiz's link and card. */
  draftFile.addEventListener("change", async () => {
    const file = draftFile.files?.[0];
    if (!file) return;
    const attempt = ++fileAttempt;
    const revision = editorRevision;
    try {
      // Refuse a runaway file before reading or parsing any of it.
      if (!Number.isFinite(file.size) || file.size > personaDraftFileLimit) {
        draftFileStatus.textContent = `That draft file is larger than ${draftFileLimit}. Your editor is unchanged.`;
        return;
      }
      const text = await file.text();
      if (attempt !== fileAttempt) return;
      // A read that lands after a later typed edit is stale: keep the edit.
      if (revision !== editorRevision) {
        draftFileStatus.textContent = "The draft file arrived after you edited this page. Open it again to replace your current text.";
        return;
      }
      const read = readPersonaDraftFile(pack.game, text, pack.questions.length, draftOutcomeIds);
      if (!read.draft) {
        draftFileStatus.textContent = draftFileProblem(read);
        return;
      }
      fillDraftEditor(read.draft);
      draftFileStatus.textContent = "Draft file opened. Review the text, then choose Play draft.";
    } catch {
      if (attempt !== fileAttempt) return;
      draftFileStatus.textContent = "That file could not be read on this device. Your editor is unchanged.";
    } finally {
      if (attempt === fileAttempt) draftFile.value = "";
    }
  });

  remixForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startDraft();
  });

  // Any typed change after a file was chosen outranks a slower read.
  remixForm.addEventListener("input", () => {
    editorRevision += 1;
  });

  draftSave.addEventListener("click", saveDraftFile);
  draftEdit.addEventListener("click", editDraft);
  draftOriginal.addEventListener("click", returnToOriginal);

  choices.forEach((button, choice) => {
    button.addEventListener("click", () => {
      answers[current] = choice;
      if (current === pack.questionCount - 1) {
        const id = pack.resolve(answers);
        if (!id) return;
        showResult(id);
        return;
      }
      showQuestion(current + 1);
    });
  });

  back.addEventListener("click", () => {
    if (current > 0) showQuestion(current - 1);
  });

  retake.addEventListener("click", () => resetRun());

  revise.addEventListener("click", () => {
    const last = answers.reduce<number>((at, answer, index) => (answer === null ? at : index), 0);
    if (!draft) replaceAddress(pack.path);
    showQuestion(last);
  });

  // Arrow keys move between the four answers; Enter and Space already choose
  // the focused button. Home and End reach the first and last answer.
  options.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
      : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "Home" ? -99
      : event.key === "End" ? 99 : 0;
    if (!step) return;
    const from = choices.indexOf(document.activeElement as HTMLButtonElement);
    if (from < 0) return;
    event.preventDefault();
    const next = step === -99 ? 0 : step === 99 ? choices.length - 1
      : (from + step + choices.length) % choices.length;
    choices[next]?.focus();
  });

  copy.addEventListener("click", async () => {
    if (!shown || draft) return;
    const href = new URL(pack.resultPath(shown), location.origin).href;
    link.value = href;
    try {
      await navigator.clipboard.writeText(href);
      copyStatus.textContent = "Result link copied. It carries the result name only — never your answers.";
    } catch {
      copyStatus.textContent = "Clipboard access was denied. The result link is selected — copy it with your device’s copy shortcut.";
      link.focus();
      link.select();
    }
  });

  // A caption uses trusted published text and links directly to the original quiz.
  captionCopy.addEventListener("click", async () => {
    if (!shown || draft) return;
    const id = shown;
    const outcome = pack.outcome(id);
    if (!outcome) return;
    const href = new URL(pack.path, location.origin).href;
    const caption = personaCaption(outcome, href);
    clearCaption();
    try {
      await navigator.clipboard.writeText(caption);
      if (shown !== id || draft) return;
      captionStatus.textContent = "Caption copied.";
    } catch {
      if (shown !== id || draft) return;
      captionStatus.textContent = "Caption selected. Use your device’s copy shortcut.";
      captionManual.value = caption;
      captionManual.hidden = false;
      captionManual.focus();
      captionManual.select();
    }
  });

  const shared = pack.outcomeFromHash(location.hash);
  if (shared) {
    showResult(shared, true);
  } else {
    if (new URLSearchParams(location.hash.slice(1)).has("result")) {
      notice.textContent = "That result link doesn’t match a result in this quiz, so you’re starting from the beginning.";
      replaceAddress(pack.path);
    }
    showQuestion(0, false);
  }

  ready = true;
  return {
    // The card is drawn from the same trusted outcome id the result panel and
    // its answer-free link use. A local draft supplies neither, so the generic
    // JSON result link and the published card stay off for it.
    result: () => {
      if (!shown || draft) return null;
      const outcome = pack.outcome(shown);
      if (!outcome) return null;
      return {
        game: pack.game,
        title: outcome.archetype,
        subtitle: outcome.subject,
        byline: "",
        skin: 0,
        background: "",
      };
    },
    linksAllowed: () => false,
    exportAllowed: () => !draft,
    personaOutcome: () => (draft ? null : shown),
    restore() {
      // Only the validated outcome fragment above can restore a result.
    },
  };
}

/** The four-row personal board. Entries are edited and reordered in place,
 * moved between rows with a labelled native select, and removed one at a time.
 * The board starts empty; the optional starter is original copy and never
 * overwrites typed work. Nothing here is saved, published or serialised into a link. */
function mountTierList(root: HTMLElement, update: () => void): Controller {
  const title = root.querySelector<HTMLInputElement>("[data-tier-title]")!;
  const starter = root.querySelector<HTMLButtonElement>("[data-tier-starter]")!;
  const addForm = root.querySelector<HTMLFormElement>("[data-tier-add]")!;
  const addText = root.querySelector<HTMLInputElement>("[data-tier-add-text]")!;
  const addRow = root.querySelector<HTMLSelectElement>("[data-tier-add-row]")!;
  const status = root.querySelector<HTMLElement>("[data-tier-status]")!;
  const lists = elements<HTMLOListElement>(root, "[data-tier-list]");
  const empties = elements<HTMLElement>(root, "[data-tier-empty]");
  const counts = elements<HTMLElement>(root, "[data-tier-count]");
  let board: TierListBoard = emptyTierListBoard();

  function sync() {
    board.forEach((row, index) => {
      counts[index].textContent = `${row.length} of ${tierListRowEntryLimit}`;
      empties[index].hidden = row.length > 0;
      lists[index].hidden = row.length === 0;
    });
    const full = tierListCount(board) >= tierListEntryTotal;
    starter.disabled = tierListCount(board) > 0;
    addForm.querySelector<HTMLButtonElement>("[type=submit]")!.disabled = full;
    Array.from(addRow.options).forEach((option, index) => {
      option.disabled = full || !tierListHasRoom(board, index);
    });
  }

  function focusEntry(row: number, index: number) {
    root.querySelector<HTMLInputElement>(
      `[data-tier-entry][data-row="${row}"][data-index="${index}"]`,
    )?.focus({ preventScroll: true });
  }

  function focusOrder(row: number, index: number, direction: "earlier" | "later") {
    const action = root.querySelector<HTMLButtonElement>(
      `[data-tier-order="${direction}"][data-row="${row}"][data-index="${index}"]`,
    );
    if (action && !action.disabled) action.focus({ preventScroll: true });
    else focusEntry(row, index);
  }

  function render() {
    board.forEach((row, rowIndex) => {
      lists[rowIndex].replaceChildren(...row.map((text, index) => {
        const item = document.createElement("li");
        item.className = "tier-entry";
        const field = document.createElement("input");
        field.type = "text";
        field.value = text;
        field.maxLength = tierListEntryLimit;
        field.autocomplete = "off";
        field.dataset.tierEntry = "";
        field.dataset.row = String(rowIndex);
        field.dataset.index = String(index);
        field.setAttribute("aria-label", `${tierListTiers[rowIndex].label} entry ${index + 1}`);
        const label = text.trim() || "this empty entry";
        const move = document.createElement("select");
        move.dataset.tierMove = "";
        move.dataset.row = String(rowIndex);
        move.dataset.index = String(index);
        move.setAttribute("aria-label", `Move ${label} to another row`);
        tierListTiers.forEach((tier, target) => {
          const option = document.createElement("option");
          option.value = String(target);
          option.textContent = tier.label;
          option.selected = target === rowIndex;
          option.disabled = target !== rowIndex && board[target].length >= tierListRowEntryLimit;
          move.append(option);
        });
        item.append(field, move);
        for (const direction of ["earlier", "later"] as const) {
          const order = document.createElement("button");
          order.type = "button";
          order.className = "secondary tier-order";
          order.dataset.tierOrder = direction;
          order.dataset.row = String(rowIndex);
          order.dataset.index = String(index);
          order.textContent = direction === "earlier" ? "Earlier" : "Later";
          order.disabled = direction === "earlier" ? index === 0 : index === row.length - 1;
          order.setAttribute("aria-label", `Move ${label} ${direction} in ${tierListTiers[rowIndex].label}`);
          item.append(order);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "secondary";
        remove.dataset.tierRemove = "";
        remove.dataset.row = String(rowIndex);
        remove.dataset.index = String(index);
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${label} from ${tierListTiers[rowIndex].label}`);
        item.append(remove);
        return item;
      }));
    });
    sync();
  }

  root.addEventListener("input", (event) => {
    const field = (event.target as HTMLElement).closest<HTMLInputElement>("[data-tier-entry]");
    if (!field) return;
    const row = Number(field.dataset.row);
    const next = editTierListEntry(board, row, Number(field.dataset.index), field.value);
    if (next) board = next;
    const label = field.value.trim() || "this empty entry";
    const item = field.closest(".tier-entry");
    item?.querySelector("[data-tier-move]")?.setAttribute("aria-label", `Move ${label} to another row`);
    item?.querySelector("[data-tier-remove]")?.setAttribute("aria-label", `Remove ${label} from ${tierListTiers[row].label}`);
    item?.querySelectorAll<HTMLButtonElement>("[data-tier-order]").forEach((button) => {
      const direction = button.dataset.tierOrder;
      if (direction === "earlier" || direction === "later") {
        button.setAttribute("aria-label", `Move ${label} ${direction} in ${tierListTiers[row].label}`);
      }
    });
    sync();
    update();
  });

  root.addEventListener("change", (event) => {
    const move = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-tier-move]");
    if (!move) return;
    const fromRow = Number(move.dataset.row);
    const index = Number(move.dataset.index);
    const toRow = Number(move.value);
    const moved = moveTierListEntry(board, fromRow, index, toRow);
    if (!moved) {
      move.value = String(fromRow);
      status.textContent = "That row is full. Choose another row first.";
      return;
    }
    if (toRow === fromRow) return;
    board = moved.board;
    render();
    update();
    focusEntry(toRow, moved.index);
    status.textContent = `Moved to ${tierListTiers[toRow].label}.`;
  });

  root.addEventListener("click", (event) => {
    const order = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tier-order]");
    if (order) {
      const row = Number(order.dataset.row);
      const index = Number(order.dataset.index);
      const direction = order.dataset.tierOrder;
      if (direction !== "earlier" && direction !== "later") return;
      const label = board[row]?.[index]?.trim() || "this empty entry";
      const moved = moveTierListEntryWithinRow(board, row, index, direction);
      if (!moved) return;
      board = moved.board;
      render();
      update();
      focusOrder(row, moved.index, direction);
      status.textContent = `Moved ${label} ${direction} in ${tierListTiers[row].label}.`;
      return;
    }
    const remove = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tier-remove]");
    if (!remove) return;
    const row = Number(remove.dataset.row);
    const index = Number(remove.dataset.index);
    const text = board[row]?.[index] ?? "";
    const next = removeTierListEntry(board, row, index);
    if (!next) return;
    board = next;
    render();
    update();
    addText.focus({ preventScroll: true });
    status.textContent = `Removed ${text.trim() || "the empty entry"} from ${tierListTiers[row].label}.`;
  });

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const row = Number(addRow.value);
    if (tierListCount(board) >= tierListEntryTotal) {
      status.textContent = `A board holds up to ${tierListEntryTotal} entries. Remove one to add another.`;
      return;
    }
    if (!tierListHasRoom(board, row)) {
      status.textContent = `${tierListTiers[row].label} already holds ${tierListRowEntryLimit} entries. Choose another row or remove one.`;
      return;
    }
    const text = addText.value.trim();
    if (!text) {
      status.textContent = "Type an entry first.";
      addText.focus();
      return;
    }
    const next = addTierListEntry(board, row, text);
    if (!next) {
      status.textContent = "That entry could not be added. Try a shorter one.";
      return;
    }
    board = next;
    addText.value = "";
    render();
    update();
    focusEntry(row, board[row].length - 1);
    status.textContent = `Added to ${tierListTiers[row].label}.`;
  });

  starter.addEventListener("click", () => {
    if (tierListCount(board) > 0) {
      status.textContent = "Remove your entries first if you want the example.";
      return;
    }
    board = startTierListBoard();
    if (!title.value.trim() || title.value === tierListDefaultTitle) title.value = tierListExampleTitle;
    render();
    update();
    focusEntry(0, 0);
    status.textContent = "Example added. Edit any entry, move it to another row, or remove it.";
  });

  title.addEventListener("input", update);
  render();
  for (const control of [title, addText, addRow]) control.disabled = false;

  return {
    result() {
      const snapshot = tierListSnapshot(title.value, board);
      return snapshot
        ? { title: snapshot.title, items: snapshot.items, tierSizes: snapshot.tierSizes }
        : null;
    },
    linksAllowed: () => false,
    restore() {
      // A tier board never travels in a result link; a crafted fragment cannot
      // fill or replace the board this tab is editing.
    },
  };
}

/** One elimination round on the noir stage. Four choices; choosing one marks
 * it gone and leaves the other three. "Choose again" restores all four. The
 * owned poster round is the default; two authored built-ins are addressable by
 * an answer-free link; a private authored round is exactly four typed choices
 * and never becomes a link, draft or stored value. */
function mountOneMustGo(root: HTMLElement, update: () => void, initialRound: OneMustGoRound): Controller {
  const roundNote = root.querySelector<HTMLElement>("[data-omg-round-note]")!;
  const roundButtons = elements<HTMLButtonElement>(root, "[data-omg-round]");
  const buttons = elements<HTMLButtonElement>(root, "[data-omg-choice]");
  const labels = elements<HTMLElement>(root, "[data-omg-choice-label]");
  const states = elements<HTMLElement>(root, "[data-omg-choice-state]");
  const status = root.querySelector<HTMLElement>("[data-omg-status]")!;
  const result = root.querySelector<HTMLElement>("[data-omg-result]")!;
  const resultTitle = root.querySelector<HTMLElement>("[data-omg-result-title]")!;
  const resultCopy = root.querySelector<HTMLElement>("[data-omg-result-copy]")!;
  const survivors = root.querySelector<HTMLUListElement>("[data-omg-survivors]")!;
  const again = root.querySelector<HTMLButtonElement>("[data-omg-again]")!;
  const form = root.querySelector<HTMLFormElement>("[data-omg-form]")!;
  const inputs = elements<HTMLInputElement>(root, "[data-omg-input]");
  const formStatus = root.querySelector<HTMLElement>("[data-omg-form-status]")!;
  const starter = root.querySelector<HTMLButtonElement>("[data-omg-starter]")!;
  const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-omg-copy]")!;
  const copyManual = root.querySelector<HTMLInputElement>("[data-omg-copy-manual]")!;
  const copyStatus = root.querySelector<HTMLElement>("[data-omg-copy-status]")!;
  let round: OneMustGoRound = initialRound;
  let gone: number | null = null;
  let copyAttempt = 0;

  function paintChoices() {
    labels.forEach((label, index) => { label.textContent = round.choices[index]; });
    buttons.forEach((button, index) => {
      button.disabled = gone !== null;
      button.classList.toggle("is-gone", gone === index);
      states[index].hidden = gone !== index;
      button.setAttribute("aria-label",
        gone === index ? `${round.choices[index]} is gone` : `Eliminate ${round.choices[index]}`);
    });
  }

  function clearResult() {
    gone = null;
    result.hidden = true;
    resultTitle.textContent = "";
    resultCopy.textContent = "";
    survivors.replaceChildren();
  }

  /** A new round always retires the previous elimination, the selected-round
   * buttons and any clipboard field still describing the old round. Typed
   * custom input is deliberately left untouched. */
  function showRound(next: OneMustGoRound) {
    round = next;
    copyAttempt += 1;
    copyManual.hidden = true;
    copyManual.value = "";
    clearResult();
    starter.hidden = round.source !== "custom";
    formStatus.textContent = "";
    paintRound();
    paintChoices();
    update();
  }

  function paintRound() {
    roundNote.textContent = oneMustGoRoundNote(round);
    const active = round.source === "builtin"
      ? round.id
      : round.source === "starter" ? "poster" : "";
    roundButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.omgRound === active));
    });
    const canLink = round.source !== "custom";
    copy.hidden = !canLink;
    copy.disabled = !canLink;
    copyStatus.textContent = canLink
      ? ""
      : "Your round stays in this tab. Only built-in rounds become links.";
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const roundButton = target.closest<HTMLButtonElement>("[data-omg-round]");
    if (roundButton) {
      const id = roundButton.dataset.omgRound;
      const next = id === "poster"
        ? oneMustGoStarter
        : id && Object.hasOwn(oneMustGoBuiltinRounds, id)
          ? oneMustGoBuiltinRounds[id as OneMustGoBuiltinId]
          : null;
      if (!next) return;
      showRound(next);
      buttons[0].focus();
      status.textContent = `${oneMustGoRoundNote(next)} is on the stage. Choose the one that goes.`;
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-omg-choice]");
    if (!button || gone !== null) return;
    const outcome = oneMustGoOutcome(round, Number(button.dataset.omgChoice));
    if (!outcome) return;
    gone = Number(button.dataset.omgChoice);
    paintChoices();
    survivors.replaceChildren(...outcome.remaining.map((choice) => {
      const item = document.createElement("li");
      item.textContent = choice;
      return item;
    }));
    resultTitle.textContent = `${outcome.gone} is gone.`;
    resultCopy.textContent = `${outcome.remaining.length} stay on the stage.`;
    result.hidden = false;
    update();
    resultTitle.focus();
    status.textContent = `${outcome.gone} is gone. ${oneMustGoRemainingLine(outcome.remaining)} stay.`;
  });

  again.addEventListener("click", () => {
    clearResult();
    paintChoices();
    update();
    buttons[0].focus();
    status.textContent = "All four are back. Choose the one that goes.";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = readOneMustGoChoices(inputs.map((input) => input.value));
    if (!read.ok) {
      formStatus.textContent = read.message;
      (inputs.find((input) => !input.value.trim()) ?? inputs[0]).focus({ preventScroll: true });
      return;
    }
    inputs.forEach((input, index) => { input.value = read.round.choices[index]; });
    showRound(read.round);
    formStatus.textContent = "Your round is on the stage.";
    buttons[0].focus();
    status.textContent = "Your four choices are ready. Choose the one that goes.";
  });

  starter.addEventListener("click", () => {
    showRound(oneMustGoStarter);
    buttons[0].focus();
    formStatus.textContent = "Back to the poster round.";
    status.textContent = "The poster round is back. Choose the one that goes.";
  });

  // The link is the canonical route for this built-in round: no choice, result,
  // byline or custom text. Moving or writing a round retires a clipboard write
  // still in flight, and a denied clipboard selects the same link in a field.
  copy.addEventListener("click", async () => {
    const path = oneMustGoRoundPath(round);
    if (!path) return;
    const href = new URL(path, location.origin).href;
    copyAttempt += 1;
    const attempt = copyAttempt;
    copyManual.hidden = true;
    copyManual.value = "";
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = "Challenge link copied. It opens this round with no choice made.";
    } catch {
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = "Clipboard access was denied. Copy the challenge link from this field.";
      copyManual.value = href;
      copyManual.hidden = false;
      copyManual.focus();
      copyManual.select();
    }
  });

  paintRound();
  paintChoices();
  for (const control of [...roundButtons, ...buttons, ...inputs, again, starter, submit]) control.disabled = false;

  return {
    result() {
      if (gone === null) return null;
      // The four print in stage order; marked is the eliminated index, which
      // the shared PNG renderer crosses out for this game.
      return { title: oneMustGoTitle, items: [...round.choices], marked: [gone] };
    },
    linksAllowed: () => false,
    restore() {
      // A round never travels in a result link; a crafted fragment cannot
      // replace the four choices this tab is playing.
    },
  };
}

/** Ten authored questions, one bounded answer at a time. Each prompt keeps its
 * own draft in this tab, so switching never discards typed words. An explicit
 * local JSON file can preserve all ten raw answers and the selected question.
 * There is no score, correction, link, public result or stored value. */
function mountWrongAnswers(root: HTMLElement, update: () => void): Controller {
  const promptButtons = elements<HTMLButtonElement>(root, "[data-wa-prompt]");
  const question = root.querySelector<HTMLElement>("[data-wa-question]")!;
  const answer = root.querySelector<HTMLTextAreaElement>("[data-wa-answer]")!;
  const count = root.querySelector<HTMLElement>("[data-wa-count]")!;
  const folio = root.querySelector<HTMLElement>("[data-wa-folio]")!;
  const status = root.querySelector<HTMLElement>("[data-wa-status]")!;
  const back = root.querySelector<HTMLButtonElement>("[data-wa-back]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-wa-next]")!;
  const clear = root.querySelector<HTMLButtonElement>("[data-wa-clear]")!;
  const draftFileSave = root.querySelector<HTMLButtonElement>("[data-wa-draft-file-save]")!;
  const draftFileInput = root.querySelector<HTMLInputElement>("[data-wa-draft-file]")!;
  const draftFileStatus = root.querySelector<HTMLElement>("[data-wa-draft-file-status]")!;
  const answers = wrongAnswerStart();
  let current = 0;
  /** A local read belongs to the answer state it started from. A newer file
   * pick, question change or edit makes any slower read stale. */
  let draftFileAttempt = 0;
  let draftRevision = 0;
  // The outer share bar calls update() once after this controller returns. No
  // stage change before that point may reach it, so the generic controller is
  // never read while it is still undefined.
  let ready = false;
  const refresh = () => { if (ready) update(); };

  function sync() {
    const prompt = wrongAnswerPrompts[current];
    question.textContent = prompt.question;
    folio.textContent = `Question ${current + 1} of ${wrongAnswerCount}`;
    count.textContent = `${answer.value.length} / ${wrongAnswerLimit}`;
    promptButtons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === current));
    });
    back.disabled = current === 0;
    next.disabled = current === wrongAnswerCount - 1;
    clear.disabled = answer.value.trim() === "";
  }

  /** Store the exact field value under the question it belongs to, then load
   * the destination's own draft without rewriting any other answer. */
  function show(index: number, focus = true) {
    if (!Number.isInteger(index) || index < 0 || index >= wrongAnswerCount) return;
    draftRevision += 1;
    answers[current] = answer.value.slice(0, wrongAnswerLimit);
    current = index;
    answer.value = answers[current];
    sync();
    if (focus) question.focus();
    refresh();
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const promptButton = target.closest<HTMLButtonElement>("[data-wa-prompt]");
    if (promptButton) {
      const index = Number(promptButton.dataset.waPrompt);
      if (index === current) {
        question.focus();
        return;
      }
      const kept = answer.value.trim() !== "";
      show(index);
      status.textContent = kept
        ? `Question ${current + 1}. Your previous answer is kept in this tab.`
        : `Question ${current + 1}.`;
      return;
    }
    if (target.closest("[data-wa-back]")) {
      if (current > 0) {
        show(current - 1);
        status.textContent = `Question ${current + 1}.`;
      }
      return;
    }
    if (target.closest("[data-wa-next]")) {
      if (current < wrongAnswerCount - 1) {
        show(current + 1);
        status.textContent = `Question ${current + 1}.`;
      }
      return;
    }
    if (target.closest("[data-wa-clear]")) {
      draftRevision += 1;
      answers[current] = "";
      answer.value = "";
      sync();
      refresh();
      answer.focus();
      status.textContent = `Answer cleared for question ${current + 1}.`;
    }
  });

  answer.addEventListener("input", () => {
    draftRevision += 1;
    answers[current] = answer.value.slice(0, wrongAnswerLimit);
    sync();
    refresh();
  });

  function draftFileProblem(read: WrongAnswerDraftFileRead): string {
    const unchanged = " Your answers are unchanged.";
    if (read.fault === "oversized") return `That answers draft is larger than ${Math.round(wrongAnswerDraftFileLimit / 1024)} KB.${unchanged}`;
    if (read.fault === "unreadable") return `That file is not valid JSON.${unchanged}`;
    if (read.fault === "schema") return `That is not a Composer Wrong Answers Only draft.${unchanged}`;
    if (read.fault === "version") return `That answers draft uses a format this page does not know. Save a fresh one here, then open that.${unchanged}`;
    if (read.fault === "shape") return `That file must hold exactly ten answer strings, with no other fields.${unchanged}`;
    if (read.fault === "long") return `Answer ${read.gap + 1} is longer than ${wrongAnswerLimit} characters.${unchanged}`;
    if (read.fault === "prompt") return `That draft’s selected question is invalid.${unchanged}`;
    return `That answers draft could not be opened.${unchanged}`;
  }

  /** Save every raw answer and the selected question to one bounded local
   * file. Blank rows survive; the PNG still cleans only the selected plate. */
  function saveAnswersDraft() {
    const draftAnswers = answers.map((text, index) => index === current ? answer.value : text);
    const text = writeWrongAnswerDraftFile(draftAnswers, current);
    if (!text) {
      draftFileStatus.textContent = "This draft could not be saved. Check that all ten answers fit the answer limit.";
      return;
    }
    let url = "";
    try {
      url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = wrongAnswerDraftFileName;
      link.rel = "noopener";
      link.click();
    } catch {
      draftFileStatus.textContent = "This browser didn’t start the download. Your answers are unchanged; try again.";
      return;
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    draftFileStatus.textContent = "Answers draft ready. It contains all ten answers and the selected question.";
  }

  /** Opening replaces all answers only after the entire file validates and any
   * existing work is confirmed. The selected prompt then renders through the
   * same state and update path as a manual question change. */
  draftFileInput.addEventListener("change", async () => {
    const file = draftFileInput.files?.[0];
    if (!file) return;
    const attempt = ++draftFileAttempt;
    const revision = draftRevision;
    try {
      // Refuse a runaway file before reading or parsing any of it.
      if (!Number.isFinite(file.size) || file.size > wrongAnswerDraftFileLimit) {
        draftFileStatus.textContent = `That answers draft is larger than ${Math.round(wrongAnswerDraftFileLimit / 1024)} KB. Your answers are unchanged.`;
        return;
      }
      const bytes = await file.arrayBuffer();
      if (attempt !== draftFileAttempt) return;
      if (revision !== draftRevision) {
        draftFileStatus.textContent = "The answers draft arrived after you changed a question or answer. Open it again to replace your answers.";
        return;
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const read = readWrongAnswerDraftFile(text);
      const draft = read.draft;
      if (!draft) {
        draftFileStatus.textContent = draftFileProblem(read);
        return;
      }
      if (answers.some((text) => text !== "") && !window.confirm(
        "Replace all ten answers with this draft? Your current answers will be cleared.",
      )) {
        draftFileStatus.textContent = "Open cancelled. Your answers are unchanged.";
        return;
      }
      if (attempt !== draftFileAttempt || revision !== draftRevision) return;
      answers.splice(0, answers.length, ...draft.answers);
      current = draft.prompt;
      answer.value = answers[current];
      draftRevision += 1;
      sync();
      refresh();
      question.focus({ preventScroll: true });
      draftFileStatus.textContent = `Answers draft opened. Question ${current + 1} is selected.`;
    } catch {
      if (attempt !== draftFileAttempt) return;
      draftFileStatus.textContent = "That file could not be read on this device. Your answers are unchanged.";
    } finally {
      if (attempt === draftFileAttempt) draftFileInput.value = "";
    }
  });

  draftFileSave.addEventListener("click", saveAnswersDraft);

  sync();
  for (const control of [...promptButtons, answer]) control.disabled = false;
  draftFileSave.disabled = false;
  draftFileInput.disabled = false;
  sync();
  ready = true;

  return {
    result() {
      const prompt = wrongAnswerPrompts[current].question;
      const plate = wrongAnswerPlate(prompt, answer.value);
      return plate
        ? { title: wrongAnswerPrintTitle, prompt: plate.prompt, answer: plate.answer }
        : null;
    },
    linksAllowed: () => false,
    restore() {
      // A sheet never travels in a result link; a crafted fragment cannot fill
      // or replace the answers this tab is writing.
    },
  };
}

/** The ten-curse docket. Each prompt keeps its own side for this tab only, and
 * choosing the other side changes it. The only link this stage makes is an
 * answer-free invite to the requested curse; there is no score, comparison,
 * result link, public vote, provider or stored value. The downloaded card
 * prints just the current curse — its prompt, side and consequence. */
function mountCursedChoices(root: HTMLElement, update: () => void, requested: number): Controller {
  const promptButtons = elements<HTMLButtonElement>(root, "[data-cc-prompt]");
  const indexMarks = elements<HTMLElement>(root, "[data-cc-index-pick]");
  const heading = root.querySelector<HTMLElement>("[data-cc-heading]")!;
  const folio = root.querySelector<HTMLElement>("[data-cc-folio]")!;
  const choiceButtons = elements<HTMLButtonElement>(root, "[data-cc-choice]");
  const choiceTexts = elements<HTMLElement>(root, "[data-cc-choice-text]");
  const reveal = root.querySelector<HTMLElement>("[data-cc-reveal]")!;
  const consequence = root.querySelector<HTMLElement>("[data-cc-consequence]")!;
  const status = root.querySelector<HTMLElement>("[data-cc-status]")!;
  const prev = root.querySelector<HTMLButtonElement>("[data-cc-prev]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-cc-next]")!;
  const clear = root.querySelector<HTMLButtonElement>("[data-cc-clear]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-cc-copy]")!;
  const copyManual = root.querySelector<HTMLInputElement>("[data-cc-copy-manual]")!;
  const copyStatus = root.querySelector<HTMLElement>("[data-cc-copy-status]")!;
  const picks: (CursedChoice | null)[] = cursedChoiceStart();
  let current = cursedChoicePrompt(requested) ? requested : 0;
  let ready = false;
  let copyAttempt = 0;
  const refresh = () => { if (ready) update(); };
  const sideLine = (side: CursedChoice | null) => {
    const entry = cursedChoicePrompt(current);
    return side === null || !entry ? "no side" : entry.choices[side];
  };
  // Moving curses retires any visible fallback and any clipboard write still
  // in flight, so a late result cannot describe a curse no longer on stage.
  const clearCopyOffer = () => {
    copyAttempt += 1;
    copyStatus.textContent = "";
    copyManual.hidden = true;
    copyManual.value = "";
  };

  function paint(focus = false) {
    const entry = cursedChoicePrompt(current)!;
    const pick = picks[current];
    heading.textContent = entry.prompt;
    folio.textContent = `Curse ${String(current + 1).padStart(2, "0")} of ${cursedChoiceCount} · ${cursedChoiceMade(picks)} chosen`;
    promptButtons.forEach((button, index) => {
      const chosen = picks[index];
      button.setAttribute("aria-pressed", String(index === current));
      button.setAttribute("aria-label",
        `Curse ${index + 1}: ${cursedChoices[index].prompt}${chosen === null ? "" : `, ${cursedChoices[index].choices[chosen]}`}`);
      const mark = indexMarks[index];
      mark.hidden = chosen === null;
      mark.textContent = chosen === null ? "" : chosen === 0 ? "A" : "B";
      button.classList.toggle("is-a", chosen === 0);
      button.classList.toggle("is-b", chosen === 1);
    });
    choiceButtons.forEach((button, index) => {
      const side = readCursedChoice(index);
      choiceTexts[index].textContent = entry.choices[index];
      button.setAttribute("aria-pressed", String(side !== null && side === pick));
    });
    reveal.hidden = pick === null;
    if (pick !== null) consequence.textContent = entry.consequences[pick];
    prev.disabled = current === 0;
    next.disabled = current === cursedChoiceCount - 1;
    clear.disabled = pick === null;
    if (focus) heading.focus();
    refresh();
  }

  function show(index: number, focus = true) {
    clearCopyOffer();
    if (!Number.isInteger(index) || index < 0 || index >= cursedChoiceCount) return;
    current = index;
    paint(focus);
    status.textContent = `Curse ${current + 1} of ${cursedChoiceCount}. ${picks[current] === null
      ? "No side picked yet."
      : `${sideLine(picks[current])} stands. Change it any time.`}`;
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const promptButton = target.closest<HTMLButtonElement>("[data-cc-prompt]");
    if (promptButton) {
      show(Number(promptButton.dataset.ccPrompt));
      return;
    }
    const choiceButton = target.closest<HTMLButtonElement>("[data-cc-choice]");
    if (choiceButton) {
      const side = readCursedChoice(Number(choiceButton.dataset.ccChoice));
      if (side === null) return;
      picks[current] = side;
      paint();
      status.textContent = `Curse ${current + 1}: ${sideLine(side)}. What it costs is on the stage and the card.`;
      return;
    }
    if (target.closest("[data-cc-prev]")) {
      if (current > 0) show(current - 1);
      return;
    }
    if (target.closest("[data-cc-next]")) {
      if (current < cursedChoiceCount - 1) show(current + 1);
      return;
    }
    if (target.closest("[data-cc-clear]")) {
      picks[current] = null;
      paint();
      heading.focus();
      status.textContent = `Curse ${current + 1} cleared. Every other choice in this tab stays.`;
    }
  });

  // The invite is the canonical route plus only this curse's ordinal. It opens
  // the exact prompt unplayed: no side, consequence, byline, answer, draft,
  // result fragment or other query. A denied clipboard selects the same link
  // in a readonly field; moving curses retires it.
  copy.addEventListener("click", async () => {
    const href = new URL(cursedChoiceInvitePath(current), location.origin).href;
    clearCopyOffer();
    const attempt = copyAttempt;
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = `Challenge link copied. It opens curse ${current + 1} with no choices.`;
    } catch {
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = "Clipboard access was denied. Copy the challenge link from this field.";
      copyManual.value = href;
      copyManual.hidden = false;
      copyManual.focus();
      copyManual.select();
    }
  });

  for (const control of [...promptButtons, ...choiceButtons, copy]) control.disabled = false;
  show(current, false);
  ready = true;

  return {
    result() {
      const pick = picks[current];
      return pick === null
        ? null
        : { title: cursedChoicesPrintTitle, cursePrompt: current, curseChoice: pick };
    },
    linksAllowed: () => false,
    restore() {
      // A curse never travels in a result link; a crafted fragment cannot fill
      // or replace the picks this tab is making.
    },
  };
}

/** The ten-case docket. Each case keeps its own call for this tab only, and
 * choosing the other flag changes it. There is no score, result link, public
 * vote, provider or stored value: the downloaded card prints just the current
 * case and its verdict. */
function mountRedFlagCourt(root: HTMLElement, update: () => void): Controller {
  const caseButtons = elements<HTMLButtonElement>(root, "[data-rfc-case]");
  const indexVerdicts = elements<HTMLElement>(root, "[data-rfc-index-verdict]");
  const caseHeading = root.querySelector<HTMLElement>("[data-rfc-heading]")!;
  const folio = root.querySelector<HTMLElement>("[data-rfc-folio]")!;
  const verdictButtons = elements<HTMLButtonElement>(root, "[data-rfc-verdict]");
  const status = root.querySelector<HTMLElement>("[data-rfc-status]")!;
  const prev = root.querySelector<HTMLButtonElement>("[data-rfc-prev]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-rfc-next]")!;
  const verdicts: (RedFlagVerdict | null)[] = Array.from(
    { length: redFlagCourtCount }, () => null,
  );
  let current = 0;
  let ready = false;
  const refresh = () => { if (ready) update(); };
  const callLine = (call: RedFlagVerdict | null) =>
    call === "green" ? "green flag" : call === "red" ? "red flag" : "no verdict";

  function paint(focus = false) {
    const entry = redFlagCourtCase(current)!;
    caseHeading.textContent = entry.habit;
    folio.textContent = `Case ${String(current + 1).padStart(2, "0")} of ${redFlagCourtCount} · ${redFlagCourtCalled(verdicts)} called`;
    caseButtons.forEach((button, index) => {
      const call = verdicts[index];
      button.setAttribute("aria-pressed", String(index === current));
      button.setAttribute("aria-label",
        `Case ${index + 1}: ${redFlagCourtCases[index].tab}${call ? `, ${callLine(call)}` : ""}`);
      const mark = indexVerdicts[index];
      mark.hidden = call === null;
      mark.textContent = call === "green" ? "G" : "R";
      button.classList.toggle("is-green", call === "green");
      button.classList.toggle("is-red", call === "red");
    });
    for (const button of verdictButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.rfcVerdict === verdicts[current]));
    }
    prev.disabled = current === 0;
    next.disabled = current === redFlagCourtCount - 1;
    if (focus) caseHeading.focus();
    refresh();
  }

  function show(index: number, focus = true) {
    if (!Number.isInteger(index) || index < 0 || index >= redFlagCourtCount) return;
    current = index;
    paint(focus);
    status.textContent = `Case ${current + 1} of ${redFlagCourtCount}. ${verdicts[current]
      ? `${callLine(verdicts[current])} stands. Change it any time.`
      : "No verdict yet."}`;
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const caseButton = target.closest<HTMLButtonElement>("[data-rfc-case]");
    if (caseButton) {
      show(Number(caseButton.dataset.rfcCase));
      return;
    }
    const verdictButton = target.closest<HTMLButtonElement>("[data-rfc-verdict]");
    if (verdictButton) {
      const call = readRedFlagVerdict(verdictButton.dataset.rfcVerdict);
      if (!call) return;
      verdicts[current] = call;
      paint();
      status.textContent = `Case ${current + 1} of ${redFlagCourtCount}: ${callLine(call)}. Change it any time.`;
      return;
    }
    if (target.closest("[data-rfc-prev]")) {
      if (current > 0) show(current - 1);
      return;
    }
    if (target.closest("[data-rfc-next]")) {
      if (current < redFlagCourtCount - 1) show(current + 1);
    }
  });

  paint();
  for (const control of [...caseButtons, ...verdictButtons, prev, next]) control.disabled = false;
  paint();
  ready = true;

  return {
    result() {
      const call = verdicts[current];
      return call
        ? { title: redFlagCourtPrintTitle, courtCase: current, verdict: call }
        : null;
    },
    linksAllowed: () => false,
    restore() {
      // The docket never travels in a result link; a crafted fragment cannot
      // fill or replace the verdicts this tab is making.
    },
  };
}

/** Seven ordered local picks through one fixed bracket. The current match is
 * the only one that can be played; undo walks back one or more picks through
 * the same bounded state. There is no result link, account, vote, score,
 * ranking, provider call or stored value: one answer-free invite opens a fresh
 * bracket, and the downloaded winner card is the only way a champion leaves
 * this tab. */
function mountTechTournament(root: HTMLElement, update: () => void): Controller {
  const buttons = elements<HTMLButtonElement>(root, "[data-tt-pick]");
  const names = elements<HTMLElement>(root, "[data-tt-name]");
  const pairs = elements<HTMLElement>(root, "[data-tt-pair]");
  const matchStates = elements<HTMLElement>(root, "[data-tt-match-state]");
  const progress = root.querySelector<HTMLElement>("[data-tt-progress]")!;
  const status = root.querySelector<HTMLElement>("[data-tt-status]")!;
  const undo = root.querySelector<HTMLButtonElement>("[data-tt-undo]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-tt-reset]")!;
  const result = root.querySelector<HTMLElement>("[data-tt-result]")!;
  const winnerName = root.querySelector<HTMLElement>("[data-tt-winner]")!;
  const winnerPair = root.querySelector<HTMLElement>("[data-tt-winner-pair]")!;
  const runnerName = root.querySelector<HTMLElement>("[data-tt-runner]")!;
  const runnerPair = root.querySelector<HTMLElement>("[data-tt-runner-pair]")!;
  const again = root.querySelector<HTMLButtonElement>("[data-tt-again]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-tt-copy]")!;
  const copyManual = root.querySelector<HTMLInputElement>("[data-tt-copy-manual]")!;
  const copyStatus = root.querySelector<HTMLElement>("[data-tt-copy-status]")!;
  let picks: (TechTournamentPick | null)[] = techTournamentStart();
  let ready = false;
  let copyAttempt = 0;
  const refresh = () => { if (ready) update(); };
  // A bracket change retires the previous invite's selected fallback and any
  // clipboard reply still in flight, so only the current view can report it.
  const clearCopyOffer = () => {
    copyAttempt += 1;
    copyManual.hidden = true;
    copyManual.value = "";
    copyStatus.textContent = "";
  };

  function paint(focus: "current" | "result" | null = null) {
    clearCopyOffer();
    const current = techTournamentCurrent(picks);
    const made = techTournamentPickCountMade(picks);
    for (const match of techTournamentMatches) {
      const participants = techTournamentParticipants(picks, match.id);
      const winner = techTournamentWinner(picks, match.id);
      for (const side of [0, 1] as const) {
        const at = match.id * 2 + side;
        const button = buttons[at];
        if (!button) continue;
        const entrant = participants?.[side] ?? null;
        names[at].textContent = entrant?.name ?? techTournamentPlaceholder(match.id, side);
        pairs[at].textContent = entrant?.pair
          ?? (match.entrants ? "" : "Waits for the winner above");
        button.disabled = match.id !== current;
        button.classList.toggle("is-winner", Boolean(entrant && winner?.id === entrant.id));
        button.classList.toggle("is-loser", Boolean(entrant && winner && winner.id !== entrant.id));
        button.setAttribute("aria-pressed", String(entrant !== null && picks[match.id] === side));
        button.setAttribute("aria-label", `${techTournamentMatchLabel(match.id)}: ${entrant?.name ?? techTournamentPlaceholder(match.id, side)}${entrant ? `, ${entrant.pair}` : ""}`);
      }
      matchStates[match.id].hidden = picks[match.id] === null;
      matchStates[match.id].textContent = winner ? `${winner.name} through` : "Chosen";
    }
    const outcome = techTournamentOutcome(picks);
    result.hidden = outcome === null;
    if (outcome) {
      winnerName.textContent = outcome.winner.name;
      winnerPair.textContent = `${outcome.winner.pair}.`;
      runnerName.textContent = outcome.runnerUp.name;
      runnerPair.textContent = outcome.runnerUp.pair;
      progress.textContent = `${techTournamentPickCount} of ${techTournamentPickCount} picks · champion chosen`;
    } else if (current !== null) {
      progress.textContent = `${techTournamentMatchLabel(current)} · ${made} of ${techTournamentPickCount} picks`;
    }
    undo.disabled = made === 0;
    reset.disabled = made === 0;
    again.disabled = outcome === null;
    if (focus === "result" && outcome) winnerName.focus();
    else if (focus === "current" && current !== null) buttons[current * 2]?.focus();
    refresh();
  }

  function restart(nextStatus: string) {
    picks = techTournamentStart();
    paint("current");
    status.textContent = nextStatus;
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("[data-tt-pick]");
    if (button && !button.disabled) {
      const [index, side] = (button.dataset.ttPick ?? "").split(":").map(Number);
      const before = picks;
      const next = techTournamentPick(picks, index, side);
      if (next.every((value, at) => value === before[at])) return;
      picks = next;
      const winner = techTournamentWinner(picks, index);
      const outcome = techTournamentOutcome(picks);
      if (outcome) {
        paint("result");
        status.textContent = `${outcome.winner.name} is your champion. ${outcome.runnerUp.name} is the runner-up.`;
        return;
      }
      paint("current");
      const upcoming = techTournamentCurrent(picks);
      const participants = upcoming === null ? null : techTournamentParticipants(picks, upcoming);
      status.textContent = winner
        ? `${winner.name} goes through. ${upcoming === null ? "" : `${techTournamentMatchLabel(upcoming)}: ${participants?.[0].name ?? "winner"} versus ${participants?.[1].name ?? "winner"}.`}`
        : "Pick a winner.";
      return;
    }
    if (target.closest("[data-tt-undo]")) {
      const before = picks;
      picks = techTournamentUndo(picks);
      if (picks.every((value, at) => value === before[at])) return;
      paint("current");
      const upcoming = techTournamentCurrent(picks);
      status.textContent = upcoming === null
        ? "The bracket is empty. Start with the first quarter-final."
        : `One pick undone. ${techTournamentMatchLabel(upcoming)} is next.`;
      return;
    }
    if (target.closest("[data-tt-reset]") || target.closest("[data-tt-again]")) {
      restart("Bracket reset. First quarter-final: Terminal versus GUI.");
    }
  });

  // The invite is always the canonical bare route: no pick, result, byline,
  // tracking query or fragment travels. Copying never changes this bracket; a
  // denied clipboard selects the same link in a readonly field.
  copy.addEventListener("click", async () => {
    const href = new URL(experiencePath("tech-tournament"), location.origin).href;
    clearCopyOffer();
    const attempt = copyAttempt;
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = "Blank bracket link copied. It opens a fresh eight-entrant bracket with no picks.";
    } catch {
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = "Clipboard access was denied. Copy the blank bracket link from this field.";
      copyManual.value = href;
      copyManual.hidden = false;
      copyManual.focus();
      copyManual.select();
    }
  });

  paint();
  copy.disabled = false;
  ready = true;

  return {
    result() {
      return techTournamentComplete(picks)
        ? { title: techTournamentTitle, tournamentPicks: [...picks] }
        : null;
    },
    linksAllowed: () => false,
    restore() {
      // A bracket never travels in a result link; a crafted fragment cannot
      // fill or replace the picks this tab is making.
    },
  };
}

function mountBingo(root: HTMLElement): Controller {
  const tiles = elements<HTMLButtonElement>(root, "[data-tile]");
  const grid = root.querySelector<HTMLElement>("[data-bingo-grid]")!;
  const score = root.querySelector<HTMLElement>("[data-score]")!;
  const pack = root.querySelector<HTMLSelectElement>("[data-bingo-pack]")!;
  const editor = root.querySelector<HTMLTextAreaElement>("[data-custom]")!;
  const note = root.querySelector<HTMLElement>("[data-custom-status]")!;
  const pool = { dev: developerBingo, agents: agentBingo, internet: internetBingo };
  let items: string[] = [];
  let marked = new Set<number>([12]);

  function sync() {
    tiles.forEach((tile, index) => {
      tile.textContent = items[index];
      tile.setAttribute("aria-pressed", String(marked.has(index)));
    });
    const lines = bingoLines.filter((line) => line.every((index) => marked.has(index))).length;
    score.textContent = lines === 0 ? "0 lines" : lines === 1 ? "Bingo! 1 line" : `Bingo! ${lines} lines`;
  }

  function setBoard(entries: readonly string[]) {
    items = [...entries.slice(0, 12), "Free space", ...entries.slice(12)];
    marked = new Set([12]);
    editor.value = entries.join("\n");
    sync();
  }

  setBoard(developerBingo);
  pack.addEventListener("change", () => {
    if (Object.hasOwn(pool, pack.value)) setBoard(pool[pack.value as keyof typeof pool]);
  });
  root.querySelector("[data-clear]")?.addEventListener("click", () => {
    marked = new Set([12]);
    sync();
  });
  const centre = 12;
  const reachable = (from: number, step: number) => {
    const horizontal = step === 1 || step === -1;
    const row = Math.floor(from / 5);
    for (let next = from + step; next >= 0 && next < tiles.length; next += step) {
      if (horizontal && Math.floor(next / 5) !== row) return null;
      if (next !== centre) return next;
    }
    return null;
  };
  tiles.forEach((tile, index) => {
    tile.addEventListener("click", () => {
      if (index === centre) return;
      if (marked.has(index)) marked.delete(index);
      else marked.add(index);
      sync();
    });
  });
  grid.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const step = event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
        : event.key === "ArrowDown" ? 5
          : event.key === "ArrowUp" ? -5 : 0;
    if (!step) return;
    const from = tiles.indexOf(event.target as HTMLButtonElement);
    if (from < 0) return;
    event.preventDefault();
    const next = reachable(from, step);
    if (next === null) return;
    tiles[next].focus();
  });
  editor.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const entries = editor.value.split(/\r?\n/).map((line) => entry(line, 42)).filter(Boolean);
    if (entries.length !== 24 || new Set(entries).size !== 24) {
      note.textContent = "Enter 24 distinct phrases.";
      return;
    }
    setBoard(entries);
    pack.value = "";
    note.textContent = "Your custom board is ready.";
  });

  return {
    result: () => ({ title: "Tech Hot-Take Bingo", items, marked: [...marked] }),
    restore(snapshot) {
      if (!Array.isArray(snapshot.items) || snapshot.items.length !== 25 || !Array.isArray(snapshot.marked)) return;
      const entries = snapshot.items.filter((_, index) => index !== 12).map((item) => entry(item, 42));
      if (entries.some((line) => !line)) return;
      setBoard(entries);
      pack.value = "";
      const marks = snapshot.marked.filter((index) => Number.isInteger(index) && index >= 0 && index < 25);
      marked = new Set([12, ...marks]);
      sync();
    },
  };
}

function sharedResult(game: ExperienceId): { snapshot: Record<string, unknown> | null; invalid: boolean } {
  // Nine additional URLs can each expand when form-encoded. Keep room for
  // the full Top Nine board while retaining the existing bound on other games.
  const limit = game === "top-nine" ? 20_000 : 10_000;
  if (location.hash.length > limit) return { snapshot: null, invalid: false };
  const shared = new URLSearchParams(location.hash.slice(1)).get("result");
  if (!shared) return { snapshot: null, invalid: false };
  try {
    const snapshot = JSON.parse(shared) as Record<string, unknown> | null;
    return snapshot && snapshot.game === game
      ? { snapshot, invalid: false }
      : { snapshot: null, invalid: false };
  } catch {
    return { snapshot: null, invalid: true };
  }
}

/** One optional photo behind a persona result card's small circle. It uses the
 * same device-image path as a Top Nine cover: bounded before decode, checked by
 * its magic bytes, decoded locally, and never uploaded. The returned object URL
 * belongs to the caller, which retires it on replace, removal or pagehide. */
type CardPhotoRead =
  | { ok: true; art: HTMLCanvasElement; url: string }
  | { ok: false; message: string };

async function readCardPhoto(file: File): Promise<CardPhotoRead> {
  if (file.size > coverFileLimit) {
    return { ok: false, message: `That image is ${Math.round(file.size / 1_048_576)} MB. Photos can be up to ${coverFileLimit / 1_048_576} MB.` };
  }
  const head = new Uint8Array(await file.slice(0, coverHeadLimit).arrayBuffer());
  const sniffed = sniffCover(head);
  if (!sniffed) {
    return { ok: false, message: "That file isn’t a readable PNG, JPEG or WebP image. Pick a photo from your device." };
  }
  if (sniffed.width * sniffed.height > coverPixelLimit) {
    return { ok: false, message: `That image is ${sniffed.width.toLocaleString()} × ${sniffed.height.toLocaleString()} pixels. Photos can be up to ${coverPixelLimit / 1_000_000} megapixels.` };
  }
  const url = URL.createObjectURL(file);
  const source = new Image();
  source.src = url;
  try {
    await source.decode();
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, message: "That image couldn’t be decoded. Export it as PNG or JPEG, then pick it again." };
  }
  if (source.naturalWidth * source.naturalHeight > coverPixelLimit) {
    URL.revokeObjectURL(url);
    return { ok: false, message: "That image is too large to use here. Try a smaller copy." };
  }
  const scale = Math.min(1, coverWorkingMax / Math.max(source.naturalWidth, source.naturalHeight));
  const art = document.createElement("canvas");
  art.width = Math.max(1, Math.round(source.naturalWidth * scale));
  art.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const artCtx = art.getContext("2d");
  if (!artCtx) {
    URL.revokeObjectURL(url);
    return { ok: false, message: "This browser couldn’t prepare that photo. Try a smaller image." };
  }
  artCtx.imageSmoothingQuality = "high";
  artCtx.drawImage(source, 0, 0, art.width, art.height);
  return { ok: true, art, url };
}

export function mountShareExperience(root: HTMLElement) {
  const game = root.dataset.experience as ExperienceId;
  if (!Object.hasOwn(experiences, game)) return;
  const persona = personaFor(game);
  const format = root.querySelector<HTMLSelectElement>("[data-format]");
  const chooseSkin = root.querySelector<HTMLSelectElement>("[data-skin-select]")!;
  const byline = root.querySelector<HTMLInputElement>("[data-byline]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const exportPanel = root.querySelector<HTMLElement>("[data-export-panel]");
  const download = root.querySelector<HTMLButtonElement>("[data-download]")!;
  const copyPng = root.querySelector<HTMLButtonElement>("[data-copy-png]");
  const preparePngShare = root.querySelector<HTMLButtonElement>("[data-prepare-png-share]");
  const sharePng = root.querySelector<HTMLButtonElement>("[data-share-png]");
  const nativePngShare = typeof navigator.share === "function" && typeof navigator.canShare === "function";
  if (preparePngShare) preparePngShare.hidden = !nativePngShare;
  if (sharePng) sharePng.hidden = true;
  let pngShareVersion = 0;
  let preparedPngShare: { version: number; file: File } | null = null;
  let preparingPngShare = false;
  let sharingPngShare = false;
  function retirePngShare() {
    if (!sharePng) return;
    pngShareVersion += 1;
    preparedPngShare = null;
    if (sharePng) {
      sharePng.hidden = true;
      sharePng.disabled = true;
    }
  }
  // Transient export preference for Top Nine only: read straight from the
  // control when a PNG is made, never copied into the result, link, draft,
  // caption or description. Absent on other games, so they keep the default.
  const nineCredit = root.querySelector<HTMLInputElement>("[data-nine-credit]");
  const copy = root.querySelector<HTMLButtonElement>("[data-copy]")!;
  const manual = root.querySelector<HTMLInputElement>("[data-manual-copy]")!;
  const alt = root.querySelector<HTMLButtonElement>("[data-copy-alt]");
  const altManual = root.querySelector<HTMLTextAreaElement>("[data-manual-alt]");
  const nativeShare = root.querySelector<HTMLButtonElement>("[data-share]")!;
  const shareNote = root.querySelector<HTMLElement>("[data-share-note]");
  const shareNoteBuiltin = shareNote?.textContent ?? "";
  // Pasting an image needs both the async Clipboard API and ClipboardItem.
  // The same capability gates the Copy PNG button added to a prepared card.
  const imageClipboard = typeof navigator.clipboard?.write === "function" && typeof ClipboardItem === "function";
  if (copyPng && !imageClipboard) copyPng.hidden = true;
  let busy = false;
  let sharing = false;
  /** The byline printed by the shared result this page restored, if any. It
   * belongs to that result, so starting a comparison clears it while the field
   * still holds it untouched; a byline the participant types is their own. */
  let restoredByline = "";
  let controller: Controller;
  let altCopyAttempt = 0;
  // One manual caption for a board that can be exported. Its text and any
  // denied-clipboard fallback belong to the heading fields they were made
  // from: an edit or a board change retires both and any write still in flight.
  const nineCaptionCopy = root.querySelector<HTMLButtonElement>("[data-nine-caption-copy]");
  const nineCaptionManual = root.querySelector<HTMLTextAreaElement>("[data-nine-caption-manual]");
  const nineCaptionStatus = root.querySelector<HTMLElement>("[data-nine-caption-status]");
  let nineCaptionAttempt = 0;
  const clearNineCaption = () => {
    if (!nineCaptionCopy) return;
    nineCaptionAttempt += 1;
    if (nineCaptionManual) {
      nineCaptionManual.hidden = true;
      nineCaptionManual.value = "";
    }
    if (nineCaptionStatus) nineCaptionStatus.textContent = "";
  };
  const cardDownloads = root.querySelector<HTMLElement>("[data-tq-downloads]");
  const cardUrls: string[] = [];
  let cardVersion = 0;
  let sharingCard = false;
  function clearCardDownloads() {
    if (!cardDownloads) return;
    cardVersion += 1;
    sharingCard = false;
    for (const href of cardUrls) URL.revokeObjectURL(href);
    cardUrls.length = 0;
    cardDownloads.replaceChildren();
    cardDownloads.hidden = true;
  }
  // A Developer Type card is one PNG, previewed beside the same Blob URL its
  // Save link downloads. Unlike the twenty-one-questions set, its image is
  // drawn from the trusted outcome id rather than any typed answer.
  const personaPreview = root.querySelector<HTMLElement>("[data-persona-preview]");
  const personaUrls: string[] = [];
  let personaVersion = 0;
  function clearPersonaPreview() {
    if (!personaPreview) return;
    personaVersion += 1;
    for (const href of personaUrls) URL.revokeObjectURL(href);
    personaUrls.length = 0;
    personaPreview.replaceChildren();
    personaPreview.hidden = true;
  }
  // The optional participant photo is a local device image for the persona
  // card only. It lives beside the renderer, never inside the result snapshot,
  // captions, storage, a draft file or any remote request.
  const avatarFile = root.querySelector<HTMLInputElement>("[data-persona-avatar-file]");
  const avatarPick = root.querySelector<HTMLButtonElement>("[data-persona-avatar-pick]");
  const avatarRemove = root.querySelector<HTMLButtonElement>("[data-persona-avatar-remove]");
  const avatarPreview = root.querySelector<HTMLImageElement>("[data-persona-avatar-preview]");
  const avatarStatus = root.querySelector<HTMLElement>("[data-persona-avatar-status]")!;
  let cardAvatar: { art: HTMLCanvasElement; url: string } | null = null;
  /** Bumped by every pick, removal, result change and pagehide, so a slower
   * decode from an earlier file can never land on a later card. */
  let avatarAttempt = 0;
  let avatarPending = false;
  /** The trusted outcome the current photo was chosen under. */
  let avatarResult = "";
  function showAvatar() {
    const present = cardAvatar !== null;
    if (avatarPreview) {
      if (cardAvatar && avatarPreview.getAttribute("src") !== cardAvatar.url) avatarPreview.src = cardAvatar.url;
      if (!cardAvatar) {
        avatarPreview.removeAttribute("src");
        avatarPreview.alt = "";
      } else avatarPreview.alt = "Your photo, shown as a small circle on the result card";
      avatarPreview.hidden = !present;
    }
    if (avatarPick) {
      avatarPick.textContent = present ? "Replace photo" : "Add a photo";
      avatarPick.setAttribute("aria-label", present
        ? "Replace the photo on your result card"
        : "Add an optional photo to your result card");
    }
    if (avatarRemove) avatarRemove.hidden = !present;
  }
  function releaseAvatar() {
    const previous = cardAvatar;
    cardAvatar = null;
    showAvatar();
    if (previous) URL.revokeObjectURL(previous.url);
  }
  /** One device photo onto the persona card. Bounded, sniffed and decoded
   * before it can replace the current circle; an older pick, removal or result
   * change leaves the newer state alone. */
  async function chooseAvatar(file: File) {
    const run = ++avatarAttempt;
    avatarPending = true;
    update();
    avatarStatus.textContent = "Preparing your photo…";
    let read: CardPhotoRead;
    try {
      read = await readCardPhoto(file);
    } catch {
      read = { ok: false, message: "That image couldn’t be read. Pick a PNG, JPEG or WebP copy." };
    }
    if (run !== avatarAttempt) {
      if (read.ok) URL.revokeObjectURL(read.url);
      return;
    }
    avatarPending = false;
    if (!read.ok) {
      update();
      avatarStatus.textContent = read.message;
      return;
    }
    releaseAvatar();
    cardAvatar = { art: read.art, url: read.url };
    showAvatar();
    update();
    avatarStatus.textContent = "Photo added. It appears only in the card you save and stays in this tab.";
  }
  avatarPick?.addEventListener("click", () => avatarFile?.click());
  avatarFile?.addEventListener("change", () => {
    const file = avatarFile.files?.[0];
    // Clearing the control lets the same file be chosen again after a removal.
    avatarFile.value = "";
    if (file) void chooseAvatar(file);
  });
  avatarRemove?.addEventListener("click", () => {
    avatarAttempt += 1;
    avatarPending = false;
    releaseAvatar();
    update();
    if (avatarStatus) avatarStatus.textContent = "Photo removed. Your card will be saved without it.";
    avatarPick?.focus({ preventScroll: true });
  });
  showAvatar();
  /** A description offered after a denied copy belongs to the board it was
   * made from, so any edit, restore or new copy clears it and invalidates a
   * clipboard write still in flight. */
  const clearAltFallback = () => {
    altCopyAttempt += 1;
    if (!altManual) return;
    altManual.hidden = true;
    altManual.value = "";
  };
  const update = () => {
    // Every board update retires a prepared file, including asynchronous cover
    // changes and draft restoration. A slower render or share-sheet completion
    // keeps its own revision and cannot replace the current board's status.
    retirePngShare();
    const canShare = Boolean(controller.result());
    // A photo already chosen stays with the next result; only a decode still in
    // flight from the previous result is retired, so it can never appear later.
    if (persona) {
      const identity = controller.personaOutcome?.() ?? "";
      if (identity !== avatarResult) {
        avatarResult = identity;
        avatarAttempt += 1;
        avatarPending = false;
      }
    }
    // A local persona draft keeps its result off the published card entirely;
    // hiding the share panel also keeps a remix from being mistaken for the
    // original quiz's export.
    const exportable = controller.exportAllowed?.() ?? true;
    if (exportPanel) exportPanel.hidden = !exportable;
    clearCardDownloads();
    clearPersonaPreview();
    // A written This-or-That set never produces a link, so URL sharing is
    // switched off only while it is on stage, with the download as the way out.
    // Twenty-one questions never produces one at all: answers are private.
    const links = controller.linksAllowed?.() ?? true;
    if (!links) {
      manual.hidden = true;
      manual.value = "";
    }
    download.disabled = busy || avatarPending || !canShare || !exportable;
    if (copyPng) copyPng.disabled = busy || avatarPending || !canShare || !exportable;
    copy.disabled = !links || !canShare || !exportable;
    if (alt) alt.disabled = !canShare || !exportable;
    nativeShare.disabled = !links || !canShare || !exportable || sharing;
    if (nineCaptionCopy) nineCaptionCopy.disabled = busy || !canShare || !exportable;
    refreshPngShareControls();
    clearAltFallback();
    clearNineCaption();
    if (shareNote && game === "this-or-that") shareNote.textContent = links
      ? shareNoteBuiltin
      : "Links and sharing are off for your own questions. Download the text-only image to keep the choices — photos stay in this tab.";
    if (!exportable) status.textContent = "";
    else if (!canShare && game === "top-nine") status.textContent = "Add a board title and nine favourites to download.";
    else if (!canShare && game === "this-or-that") status.textContent = links
      ? "Answer every question to share your result."
      : "Answer every question to download your result.";
    else if (!canShare && game === "twenty-one-questions") {
      status.textContent = "";
    } else if (!canShare && game === "tier-list") {
      status.textContent = "Add at least one entry to download your board.";
    } else if (!canShare && game === "one-must-go") {
      status.textContent = "Eliminate one choice to download your result.";
    } else if (!canShare && game === "wrong-answers") {
      status.textContent = "Write a wrong answer to download your plate.";
    } else if (!canShare && game === "red-flag-court") {
      status.textContent = "Call the current case red or green to download your verdict card.";
    } else if (!canShare && game === "tech-tournament") {
      status.textContent = "Pick a winner in all seven matches to download your winner card.";
    } else if (!canShare && game === "cursed-choices") {
      status.textContent = "Pick a side for the current curse to download your card.";
    } else if (!canShare && persona) {
      status.textContent = "Answer all eight questions to make your result card.";
    } else if (!canShare) status.textContent = "Find an ending to share.";
    else status.textContent = "";
  };
  function refreshPngShareControls() {
    if (!preparePngShare || !sharePng) return;
    const available = nativePngShare;
    const ready = Boolean(controller.result()) && (controller.exportAllowed?.() ?? true) && !avatarPending;
    preparePngShare.hidden = !available;
    preparePngShare.disabled = !available || busy || preparingPngShare || sharingPngShare || !ready;
    preparePngShare.textContent = preparingPngShare ? "Preparing PNG…" : "Prepare PNG to share";
    const prepared = preparedPngShare !== null;
    sharePng.hidden = !available || !prepared;
    sharePng.disabled = !available || !prepared || sharingPngShare || !ready;
  }
  const pickSkin = () => { root.dataset.skin = chooseSkin.value; };
  controller = game === "pick-a-door" ? mountDoor(root, update)
    : game === "top-nine" ? mountNine(root, update, byline, chooseSkin, pickSkin)
    : game === "this-or-that" ? mountThisOrThat(root, update, () => {
      if (byline.value === restoredByline) byline.value = "";
    })
    : game === "twenty-one-questions" ? mountTwentyQuestions(root, update)
    : game === "tier-list" ? mountTierList(root, update)
    : game === "one-must-go" ? mountOneMustGo(root, update, oneMustGoRoundFromQuery(location.search))
    : game === "wrong-answers" ? mountWrongAnswers(root, update)
    : game === "red-flag-court" ? mountRedFlagCourt(root, update)
    : game === "tech-tournament" ? mountTechTournament(root, update)
    : game === "cursed-choices" ? mountCursedChoices(root, update, cursedChoiceFromQuery(location.search))
    : persona ? mountPersona(root, update, persona)
    : mountBingo(root);
  chooseSkin.addEventListener("change", () => {
    pickSkin();
    if (cardDownloads || personaPreview || preparePngShare) update();
  });
  if (preparePngShare) {
    format?.addEventListener("change", update);
    byline.addEventListener("input", update);
    nineCredit?.addEventListener("change", update);
    window.addEventListener("pagehide", retirePngShare);
  }
  if (cardDownloads || personaPreview) {
    // Changing format retires the old set at once: update() revokes its links
    // and bumps the version, so a render already in flight from the previous
    // format cannot append its downloads to the new choice.
    format?.addEventListener("change", update);
    byline.addEventListener("input", update);
    window.addEventListener("pagehide", () => {
      clearCardDownloads();
      clearPersonaPreview();
      avatarAttempt += 1;
      avatarPending = false;
      releaseAvatar();
    });
  }

  // Twenty-one questions, the tier list, one-must-go, wrong-answers, the Red
  // Flag Court docket, the Internet World Cup bracket and the Cursed Choices
  // docket never produce result links, and a persona result link is the
  // answer-free `#result=<id>` fragment the quiz reads itself: none is the
  // generic JSON snapshot, so a crafted hash restores nothing.
  const shared = game === "red-flag-court" || game === "twenty-one-questions" || game === "developer-type" || game === "language-type" || game === "tier-list" || game === "one-must-go" || game === "wrong-answers" || game === "tech-tournament" || game === "cursed-choices"
    ? { snapshot: null as Record<string, unknown> | null, invalid: false }
    : sharedResult(game);
  if (shared.snapshot) {
    const snapshot = shared.snapshot;
    const skin = snapshot.skin;
    chooseSkin.value = skin === 1 || skin === 2 ? String(skin) : "0";
    restoredByline = entry(snapshot.byline, 48);
    byline.value = restoredByline;
    controller.restore(snapshot);
    pickSkin();
  } else if (shared.invalid) {
    status.textContent = "This result link could not be read. You can still start a new one.";
  }
  controller.resumeDraft?.(Boolean(shared.snapshot));
  update();
  controller.activate?.();

  const result = (): ShareExperienceResult | null => {
    const snapshot = controller.result();
    return snapshot ? { ...snapshot, game, byline: entry(byline.value, 48), skin: Number(chooseSkin.value), background: root.dataset.background ?? "" } : null;
  };

  const resultLink = (snapshot: ShareExperienceResult) => {
    const { background: _background, ...data } = snapshot;
    const url = new URL(location.pathname, location.origin);
    url.hash = new URLSearchParams({ result: JSON.stringify(data) }).toString();
    return url.href;
  };

  const offerManualCopy = (href: string) => {
    if (controller.linksAllowed?.() === false) return;
    manual.value = href;
    manual.hidden = false;
    manual.focus();
    manual.select();
  };

  download.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || busy || avatarPending || controller.exportAllowed?.() === false) return;
    const personaOutcome = controller.personaOutcome;
    busy = true;
    update();
    status.textContent = personaOutcome
      ? "Preparing your card…"
      : cardDownloads ? "Preparing your cards…" : "Preparing your image…";
    const attempt = cardVersion;
    const personaAttempt = personaVersion;
    try {
      // Links, web pages and the optional profile belong to the interactive
      // result and result link; the image stays text-only.
      const { hrefs: _links, profile: _profile, pages: _pages, ...drawn } = snapshot;
      const formatValue = format?.value;
      const size = formatValue && Object.hasOwn(resultSizes, formatValue) ? formatValue as ResultFormat : "portrait";
      if (personaOutcome) {
        const outcome = personaOutcome();
        const cardCopy = outcome && persona ? persona.card(outcome) : null;
        if (!outcome || !cardCopy || !persona) {
          busy = false;
          update();
          status.textContent = "Couldn’t prepare the card. Try again.";
          return;
        }
        // A crafted select value cannot widen the card: only these three print.
        const cardFormat = size === "square" || size === "story" ? size : "portrait";
        const printedByline = entry(byline.value, 48);
        const hasPortrait = cardAvatar !== null;
        const blob = await renderPersonaCard(cardCopy, cardFormat, {
          byline: printedByline,
          skin: Number(chooseSkin.value),
          game,
          label: persona.cardLabel,
          credit: persona.cardCredit,
          avatar: cardAvatar?.art ?? null,
        });
        const current = personaAttempt === personaVersion;
        busy = false;
        update();
        if (!current || !personaPreview) return;
        const href = URL.createObjectURL(blob);
        personaUrls.push(href);
        // The version fixes which result this prepared card holds; update()
        // clears the figure on a changed format, style, byline, revise or
        // retake, so neither its image nor its description can go stale.
        const version = personaVersion;
        const description = personaCardAltText(cardCopy, printedByline, hasPortrait);
        const figure = document.createElement("figure");
        figure.className = "tq-card";
        const preview = document.createElement("img");
        preview.className = "tq-card-preview";
        preview.src = href;
        preview.alt = description;
        const meta = document.createElement("figcaption");
        meta.className = "tq-card-meta";
        const filename = `${game}-${outcome}-${cardFormat}.png`;
        const personaFileToShare = twentyOneShareFile(blob, filename, navigator);
        const link = document.createElement("a");
        link.className = "button secondary";
        link.href = href;
        link.download = filename;
        link.textContent = `Save ${cardFormat} PNG`;
        meta.append(link);
        if (personaFileToShare) {
          // Share the exact Blob behind this preview and Save link, with the
          // same filename and PNG type. No URL, title, text, fields or remix
          // data is added, and the native call runs during the click without
          // a render or other await. Cancellation or denial keeps Save beside it.
          let sharingPersona = false;
          const shareButton = document.createElement("button");
          shareButton.type = "button";
          shareButton.className = "button secondary";
          shareButton.textContent = "Share PNG";
          shareButton.setAttribute("aria-label", `Share ${cardFormat} PNG`);
          shareButton.addEventListener("click", async () => {
            if (sharingPersona || version !== personaVersion) return;
            sharingPersona = true;
            try {
              await navigator.share({ files: [personaFileToShare] });
              if (version !== personaVersion) return;
              status.textContent = "Card PNG handed to your device’s share sheet.";
            } catch (error) {
              if (version !== personaVersion) return;
              // Keep the prepared card available for another tap or Save.
              status.textContent = error instanceof DOMException && error.name === "AbortError"
                ? "Sharing cancelled. Your card is still ready."
                : `Couldn’t share the card PNG. Use Save ${cardFormat} PNG to keep it.`;
            } finally {
              sharingPersona = false;
            }
          });
          meta.append(shareButton);
        }
        if (imageClipboard) {
          // Copy the very Blob behind this preview and Save link, not a new
          // render or its URL. Both this and the description below belong to
          // the one prepared, versioned card.
          let copying = false;
          const copyButton = document.createElement("button");
          copyButton.type = "button";
          copyButton.className = "button secondary";
          copyButton.textContent = "Copy PNG";
          copyButton.addEventListener("click", async () => {
            if (copying || version !== personaVersion) return;
            copying = true;
            try {
              // Give Safari the PNG during the tap, before the write is consumed.
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
              if (version !== personaVersion) return;
              status.textContent = "Card image copied. Paste it where you want to share it.";
            } catch {
              if (version !== personaVersion) return;
              // Save PNG stays visible in this figure as the fallback.
              status.textContent = "Clipboard unavailable. Use Save PNG to keep the card.";
            } finally {
              copying = false;
            }
          });
          meta.append(copyButton);
        }
        // A plain description of this card's printed result, copied as text
        // with a selected readonly fallback when text clipboard is denied.
        const copyDescription = document.createElement("button");
        copyDescription.type = "button";
        copyDescription.className = "button secondary";
        copyDescription.textContent = "Copy image description";
        const descriptionManual = document.createElement("textarea");
        descriptionManual.hidden = true;
        descriptionManual.readOnly = true;
        descriptionManual.rows = 3;
        descriptionManual.value = description;
        descriptionManual.setAttribute("aria-label", "Image description text");
        let copyingDescription = false;
        copyDescription.addEventListener("click", async () => {
          if (copyingDescription || version !== personaVersion) return;
          copyingDescription = true;
          try {
            await navigator.clipboard.writeText(description);
            if (version !== personaVersion) return;
            status.textContent = "Image description copied. Paste it into your image’s alt text.";
          } catch {
            if (version !== personaVersion) return;
            descriptionManual.hidden = false;
            descriptionManual.focus();
            descriptionManual.select();
            status.textContent =
              "Clipboard access was denied. The image description is selected below — copy it with your device’s copy shortcut.";
          } finally {
            copyingDescription = false;
          }
        });
        meta.append(copyDescription, descriptionManual);
        figure.append(preview, meta);
        personaPreview.append(figure);
        personaPreview.hidden = false;
        status.textContent = "Your result card is ready. Save the exact PNG below.";
        return;
      }
      if (cardDownloads) {
        // Private cards only come in the 4:5 default, the 9:16 Story or Square;
        // a crafted select value cannot turn answers into another result size.
        const cardFormat = size === "story" || size === "square" ? size : "portrait";
        const cards = await renderExperienceCards(drawn, cardFormat);
        const current = attempt === cardVersion;
        busy = false;
        update();
        if (!current) return;
        // Portrait keeps its original filename; Story and Square name their canvas.
        const prefix = cardFormat === "portrait" ? "" : `${cardFormat}-`;
        const version = cardVersion;
        let copyingCard = false;
        cards.forEach((blob, index) => {
          // One Blob URL per card feeds both the preview and its save link, so
          // the PNG a creator inspects is the exact file the link downloads.
          const href = URL.createObjectURL(blob);
          cardUrls.push(href);
          const filename = `${game}-${prefix}card-${index + 1}-of-${cards.length}.png`;
          const fileToShare = twentyOneShareFile(blob, filename, navigator);
          const figure = document.createElement("figure");
          figure.className = "tq-card";
          const preview = document.createElement("img");
          preview.className = "tq-card-preview";
          preview.src = href;
          preview.alt = `Card ${index + 1} preview`;
          const meta = document.createElement("figcaption");
          meta.className = "tq-card-meta";
          const link = document.createElement("a");
          link.className = "button secondary";
          link.href = href;
          link.download = filename;
          link.textContent = `Save card ${index + 1} of ${cards.length}`;
          meta.append(link);
          if (fileToShare) {
            // Share the very Blob behind this preview and Save link, with the
            // same filename and PNG type. No URL, title, text or result link is
            // added, and the native call runs during the click without a render
            // or other await. One lock covers every card in this prepared set.
            const shareButton = document.createElement("button");
            shareButton.type = "button";
            shareButton.className = "button secondary";
            shareButton.textContent = "Share PNG";
            shareButton.setAttribute("aria-label", `Share card ${index + 1} of ${cards.length} PNG`);
            shareButton.addEventListener("click", async () => {
              if (sharingCard || version !== cardVersion) return;
              sharingCard = true;
              try {
                await navigator.share({ files: [fileToShare] });
                if (version !== cardVersion) return;
                status.textContent = `Card ${index + 1} handed to your device’s share sheet.`;
              } catch (error) {
                if (version !== cardVersion) return;
                // Cancelling is quiet. Save stays beside this exact card for any
                // rejection; neither the Blob nor its filename is replaced.
                status.textContent = error instanceof DOMException && error.name === "AbortError"
                  ? ""
                  : `Couldn’t share card ${index + 1}. Use Save card ${index + 1} of ${cards.length} to keep the PNG.`;
              } finally {
                if (version === cardVersion) sharingCard = false;
              }
            });
            meta.append(shareButton);
          }
          if (imageClipboard) {
            // Copy the exact Blob behind this card's preview and Save link,
            // never a fresh render. Its version belongs to this prepared set:
            // an answer edit, format or style change, replay, a new set or a
            // page hide clears the set and retires a write still in flight.
            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.className = "button secondary";
            copyButton.textContent = "Copy PNG";
            copyButton.setAttribute("aria-label", `Copy card ${index + 1} of ${cards.length} PNG`);
            copyButton.addEventListener("click", async () => {
              if (copyingCard || version !== cardVersion) return;
              copyingCard = true;
              try {
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                if (version !== cardVersion) return;
                status.textContent = `Card ${index + 1} image copied. Paste it where you want to share it.`;
              } catch {
                if (version !== cardVersion) return;
                // The Save link in this figure stays available as the fallback.
                status.textContent = `Clipboard unavailable. Use Save card ${index + 1} of ${cards.length} to keep this card.`;
              } finally {
                copyingCard = false;
              }
            });
            meta.append(copyButton);
          }
          figure.append(preview, meta);
          cardDownloads.append(figure);
        });
        cardDownloads.hidden = false;
        status.textContent = cards.length === 1 ? "Your card is ready." : "Your cards are ready.";
        return;
      }
      const blob = await renderExperienceResult(drawn, size, controller.exportCovers?.() ?? undefined, nineCredit?.checked ?? true);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${game}-${size}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      busy = false;
      update();
      status.textContent = "Your image is ready.";
    } catch {
      busy = false;
      update();
      status.textContent = personaOutcome
        ? "Couldn’t prepare the card. Try again."
        : cardDownloads
          ? "Couldn’t prepare the cards. Try again."
          : controller.linksAllowed?.() === false
            ? "Couldn’t prepare the image. Try again."
            : "Couldn’t prepare the image. Try again, or copy the result link.";
    }
  });

  // Paste the very PNG Download result renders, from the same snapshot,
  // format, skin, byline and local cover pixels. No upload or save.
  copyPng?.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || busy || controller.exportAllowed?.() === false) return;
    busy = true;
    update();
    status.textContent = "Copying image…";
    let message: string;
    try {
      // Links, web pages and the optional profile belong to the interactive
      // result and result link; the pasted image stays text-only.
      const { hrefs: _links, profile: _profile, pages: _pages, ...drawn } = snapshot;
      const formatValue = format?.value;
      const size = formatValue && Object.hasOwn(resultSizes, formatValue) ? formatValue as ResultFormat : "portrait";
      // Give Safari the PNG promise during the tap, before any export or decode wait.
      const png = renderExperienceResult(drawn, size, controller.exportCovers?.() ?? undefined, nineCredit?.checked ?? true);
      void png.catch(() => {}); // The OS can reject the write before it consumes the PNG.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      message = "Image copied. Paste it where you want to share it.";
    } catch {
      message = "Clipboard unavailable. Use Download result to save the PNG.";
    } finally {
      busy = false;
      update();
    }
    status.textContent = message;
  });

  // Top Nine can prepare the exact Download PNG, then hand that same File to
  // the native share sheet from a second click. No result URL or publication
  // is involved, and every board update retires the prepared file.
  preparePngShare?.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || busy || preparingPngShare || sharingPngShare || !nativePngShare || controller.exportAllowed?.() === false) return;
    const { hrefs: _links, profile: _profile, pages: _pages, ...drawn } = snapshot;
    const formatValue = format?.value;
    const size = formatValue && Object.hasOwn(resultSizes, formatValue) ? formatValue as ResultFormat : "portrait";
    preparingPngShare = true;
    retirePngShare();
    const version = pngShareVersion;
    refreshPngShareControls();
    status.textContent = "Preparing PNG…";
    let file: File | null = null;
    let message = "";
    try {
      const blob = await renderExperienceResult(drawn, size, controller.exportCovers?.() ?? undefined, nineCredit?.checked ?? true);
      if (version === pngShareVersion) {
        const candidate = new File([blob], `${game}-${size}.png`, { type: "image/png" });
        let supported = false;
        try {
          supported = navigator.canShare({ files: [candidate] });
        } catch {
          supported = false;
        }
        if (supported) {
          file = candidate;
          message = "PNG ready. Choose Share PNG to open your device’s share sheet.";
        } else {
          message = "This PNG can’t be shared from this browser. Use Download result to save it.";
        }
      }
    } catch {
      if (version === pngShareVersion) message = "Couldn’t prepare the PNG. Try again, or use Download result.";
    }
    preparingPngShare = false;
    if (version === pngShareVersion) {
      if (file) preparedPngShare = { version, file };
      status.textContent = message;
    }
    refreshPngShareControls();
  });

  sharePng?.addEventListener("click", async () => {
    const prepared = preparedPngShare;
    if (!prepared || prepared.version !== pngShareVersion || sharingPngShare || !controller.result() || controller.exportAllowed?.() === false) return;
    sharingPngShare = true;
    refreshPngShareControls();
    status.textContent = "Opening share sheet…";
    try {
      await navigator.share({ files: [prepared.file] });
      if (prepared.version === pngShareVersion) {
        preparedPngShare = null;
        status.textContent = "PNG handed to your share sheet.";
      }
    } catch (error) {
      if (prepared.version === pngShareVersion) {
        status.textContent = (error as { name?: string } | null)?.name === "AbortError"
          ? "Sharing cancelled. Your PNG is still ready."
          : "Couldn’t share the PNG. Try Share PNG again, or use Download result.";
      }
    } finally {
      sharingPngShare = false;
      refreshPngShareControls();
    }
  });

  copy.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || controller.linksAllowed?.() === false || controller.exportAllowed?.() === false) return;
    const href = resultLink(snapshot);
    manual.hidden = true;
    manual.value = "";
    clearAltFallback();
    try {
      await navigator.clipboard.writeText(href);
      status.textContent = "Result link copied.";
    } catch {
      status.textContent = "Clipboard access was denied. Copy the address from this field.";
      offerManualCopy(href);
    }
  });

  // One manual caption for a board that can be exported: the heading fields it
  // prints and a bare invite to the canonical Top Nine path on this instance.
  // No result, exhibit title, cover, local draft, profile address, publishing
  // or provider call takes part. The explicit Copy result link stays available
  // for creators who deliberately want the full serialized board.
  nineCaptionCopy?.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || game !== "top-nine" || controller.exportAllowed?.() === false) return;
    const caption = topNineCaption(snapshot, location.origin);
    if (!caption) return;
    clearNineCaption();
    const attempt = nineCaptionAttempt;
    try {
      await navigator.clipboard.writeText(caption);
      if (attempt !== nineCaptionAttempt) return;
      if (nineCaptionStatus) nineCaptionStatus.textContent = "Caption copied.";
    } catch {
      if (attempt !== nineCaptionAttempt) return;
      if (nineCaptionStatus) nineCaptionStatus.textContent = "Caption selected. Use your device’s copy shortcut.";
      if (nineCaptionManual) {
        nineCaptionManual.value = caption;
        nineCaptionManual.hidden = false;
        nineCaptionManual.focus();
        nineCaptionManual.select();
      }
    }
  });

  /** The same completed export snapshot the image is drawn from, reduced to
   * the text it prints: no links, covers or file detail reach the clipboard. */
  alt?.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot) return;
    const text = game === "this-or-that" ? thisOrThatAltText(snapshot)
      : game === "tier-list" ? tierListAltText(snapshot)
        : game === "one-must-go" ? oneMustGoAltText(snapshot)
          : game === "wrong-answers" ? wrongAnswersAltText(snapshot)
            : game === "red-flag-court" ? redFlagCourtAltText(snapshot)
              : game === "tech-tournament" ? techTournamentAltText(snapshot)
                : game === "cursed-choices" ? cursedChoicesAltText(snapshot)
                : topNineAltText({
              title: snapshot.title, subtitle: snapshot.subtitle, byline: snapshot.byline, date: snapshot.date, items: snapshot.items ?? [],
              ranked: snapshot.ranked === true,
            });
    if (!text) {
      status.textContent = game === "this-or-that"
        ? "Answer every question to describe your result for alt text."
        : game === "top-nine"
          ? "Enter a title and nine exhibits to describe them for alt text."
          : "Make a result to describe it for alt text.";
      return;
    }
    manual.hidden = true;
    manual.value = "";
    clearAltFallback();
    const attempt = altCopyAttempt;
    try {
      await navigator.clipboard.writeText(text);
      if (attempt !== altCopyAttempt) return;
      status.textContent = "Image description copied. Paste it into your image’s alt text.";
    } catch {
      if (attempt !== altCopyAttempt) return;
      status.textContent =
        "Clipboard access was denied. The image description is selected below — copy it with your device’s copy shortcut.";
      if (altManual) {
        altManual.value = text;
        altManual.hidden = false;
        altManual.focus();
        altManual.select();
      }
    }
  });

  // The byline is printed text too. Changing it retires a description offered
  // after a denied copy, so the selected field can never hold last time's name.
  if (alt) byline.addEventListener("input", clearAltFallback);

  // Twenty-one questions, one-must-go, wrong-answers, the Red Flag Court
  // docket, the Internet World Cup bracket and Cursed Choices have no result
  // link to hand over, and a persona result hands its answer-free link over in
  // the result panel instead. The native share sheet stays off for all of them.
  if (typeof navigator.share === "function" && game !== "twenty-one-questions" && game !== "tier-list" && game !== "one-must-go" && game !== "wrong-answers" && game !== "red-flag-court" && game !== "cursed-choices" && game !== "tech-tournament" && !persona) {
    nativeShare.hidden = false;
    nativeShare.addEventListener("click", async () => {
      if (sharing) return;
      const snapshot = result();
      if (!snapshot || controller.linksAllowed?.() === false) return;
      const href = resultLink(snapshot);
      manual.hidden = true;
      manual.value = "";
      sharing = true;
      update();
      let outcome: string;
      try {
        await navigator.share({ title: snapshot.title, url: href });
        outcome = "Handed to your device’s share sheet.";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          outcome = "Sharing cancelled.";
        } else {
          outcome = "Couldn’t open the share sheet. Copy the result link below.";
          offerManualCopy(href);
        }
      } finally {
        sharing = false;
        update();
      }
      status.textContent = outcome;
    });
  }
}
