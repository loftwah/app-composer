import {
  agentBingo, developerBingo, doorEndings, experiences, internetBingo,
  thisOrThatPacks, twentyOneQuestions, twentyOneResultTitle,
  type ExperienceId, type ThisOrThatPack,
} from "../lib/share-experiences.ts";
import {
  pickThisOrThat, restoreThisOrThatLength, restoreThisOrThatPack, restoreThisOrThatPicks,
  checkThisOrThatPhoto, cleanThisOrThatAlt, customThisOrThatOptionLimit,
  customThisOrThatTitle, freezeThisOrThatPhotos,
  moveThisOrThatCustom, readThisOrThatCustom,
  thisOrThatBlankLink, thisOrThatComplete, thisOrThatCount, thisOrThatPackFromQuery,
  thisOrThatProgress, thisOrThatStart, thisOrThatSummary, undoThisOrThat,
  type ThisOrThatLength, type ThisOrThatPromptPhoto,
} from "../lib/this-or-that.ts";
import {
  moveTwentyOne, readTwentyOnePrompts, setTwentyOneAnswer, skipTwentyOne,
  twentyOneAnswered, twentyOneAnswerLimit, twentyOneBlankPath, twentyOneCount,
  twentyOnePairs, twentyOnePromptLimit, twentyOneStart,
} from "../lib/twenty-one-questions.ts";
import { personaFor } from "../lib/persona-packs.ts";
import {
  personaCaption, personaDraftFileLimit, personaDraftFileName, readPersonaDraft,
  readPersonaDraftFile, writePersonaDraftFile,
  type PersonaDraft, type PersonaDraftFileRead, type PersonaDraftGap, type PersonaPack,
} from "../lib/persona-quiz.ts";
import {
  renderExperienceCards, renderExperienceResult, renderPersonaCard, resultSizes,
  type ResultCoverSlot, type ResultFormat, type ShareExperienceResult,
} from "./share-experience-image.ts";
import {
  cleanText, clearNineDraft, nineSubtitleLimit, readNineDraft, writeNineDraft,
  type DraftStorage, type NineDraft,
} from "../lib/share-experience-draft.ts";
import { profileUrl } from "../lib/top-nine-profile.ts";
import { nineListApplied, nineListSummary, planNineList, planNineListUndo } from "../lib/top-nine-list.ts";
import { normalisePageLinks, pageLink } from "../lib/top-nine-pages.ts";
import {
  searchBooks,
} from "../lib/top-nine-books.ts";
import {
  searchApps,
} from "../lib/top-nine-apps.ts";
import {
  musicPreview, musicSearchLinks, searchMusic,
  albumTitleApplies, appleAlbumRef, lookupAppleAlbum,
  lookupSpotifyAlbumTitle, spotifyAlbumRef,
} from "../lib/top-nine-music.ts";
import {
  searchWikidata, type GamePlatformFilter, type WikidataPick,
} from "../lib/top-nine-wikidata.ts";
import {
  coverFileLimit, coverHeadLimit, coverPixelLimit, coverWorkingMax, sniffCover, type CoverFit,
} from "../lib/top-nine-cover.ts";
import { topNineAltText } from "../lib/top-nine-alt-text.ts";
import {
  normaliseSourceLinks, sourceLink,
  type SourceKind,
} from "../lib/top-nine-source.ts";
import type { CataloguePick } from "../lib/itunes-catalogue.ts";

type SearchPick = CataloguePick | WikidataPick;

interface ResultSnapshot {
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Which This or That starter a shared link reopens; absent means maker. */
  pack?: ThisOrThatPack;
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
  /** The frozen authored prompts a private 21-questions card export draws. */
  questions?: string[];
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
    restore(snapshot) {
      const title = entry(snapshot.title, 72);
      const subtitle = entry(snapshot.subtitle, 240);
      if (title && subtitle) reveal({ title, subtitle }, false);
    },
  };
}

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
  const previewSubtitle = root.querySelector<HTMLElement>("[data-nine-preview-subtitle]");
  const previewCells = elements<HTMLElement>(root, "[data-nine-preview-cell]");
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
  /** The slots and exact titles one pasted fill added, kept whole so Undo
   * clears that fill in one step and returns its lines to the editor. */
  let lastFill: { indexes: number[]; titles: string[] } | null = null;
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
   * For album queries only, one explicit action searches Wikidata albums with
   * the exact current term; those results stay release details — playback comes
   * only from an Apple Music or Spotify link. */
  function showRecovery(query: string, country: string, wiki: boolean, albumAction = false) {
    for (const anchor of [music.recoveryApple, music.recoverySpotify, music.recoveryWikidata]) {
      anchor.hidden = true;
      anchor.removeAttribute("href");
    }
    music.recoveryAlbums.hidden = !albumAction;
    if (wiki) {
      music.recoveryWikidata.href =
        `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(query.toWellFormed())}`;
      music.recoveryWikidata.hidden = false;
      music.recoveryNote.textContent =
        "Wrong match? Search Wikidata, open the exact film, TV series or game, copy its link and paste it below.";
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
    if (hrefs[index] !== href) cancelLookup(index);
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
    const ranked = rankedBox.checked;
    const line = entry(subtitle.value, nineSubtitleLimit);
    if (previewSubtitle) {
      previewSubtitle.textContent = line;
      previewSubtitle.hidden = !line;
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
      const row = document.createElement("li");
      if (article) row.className = "has-article";
      const button = document.createElement("button");
      button.type = "button";
      const heading = document.createElement("strong");
      heading.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = [artist, year, platform, source.provider].filter(Boolean).join(" · ")
        || `Unlisted · ${source.provider}`;
      button.append(heading, detail);
      button.addEventListener("click", () => fillFromPick(pick));
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
    resultPicks = [];
    shownResults = 0;
    music.more.hidden = true;
    music.results.hidden = true;
    music.results.replaceChildren();
    closeSearchPreview();
  }

  function fillFromPick(pick: SearchPick) {
    const source = sourceLink(pick.href);
    const name = entry(pick.title, 54);
    if (!source || !name) {
      note("That result has no usable Apple Music, Spotify, Apple Books, App Store or Wikidata link. Try another.");
      return;
    }
    const artist = entry(pick.artist, 48);
    const year = yearOf(pick.year);
    const filled = target + 1;
    // Films, TV series and games read as "Dune (2021)"; the description is
    // shown in the result row, not typed into the exhibit. Wikidata album
    // picks get the same title/year and one metadata-only note: playback needs
    // a real Apple Music or Spotify link, never an inferred provider ID.
    objects[target].value = entry(source.provider === "Wikidata"
      ? year ? `${name} (${year})` : name
      : artist ? `${name} · ${artist}` : name, 54);
    setLink(target, source.href);
    const empty = firstEmpty();
    if (empty >= 0) target = empty;
    markTarget();
    note(`${name} added to exhibit ${filled}.${empty >= 0 ? ` Next pick fills exhibit ${target + 1}.` : ""}${
      albumWikiSearch && source.provider === "Wikidata"
        ? " The Wikidata link is release details only — paste an Apple Music or Spotify link for playback."
        : ""}`);
    update();
  }

  /** A deliberate paste of an Apple Music or Spotify album link keeps the
   * canonical link and its preview immediately, then restores the public title
   * from that exact album ID; Apple Music also carries its artist. A miss, a
   * non-album link or a failure leaves the link and manual title entry alone,
   * and only the same still-empty slot can be filled — never a typed title, a
   * replaced link, a moved exhibit or a rebuilt board. */
  async function fillAlbumTitle(slot: number, href: string) {
    const apple = appleAlbumRef(href);
    if (!apple && !spotifyAlbumRef(href)) return;
    const provider = apple ? "Apple Music" : "Spotify";
    const controller = new AbortController();
    pendingLookups.get(slot)?.abort();
    pendingLookups.set(slot, controller);
    const filled = slot + 1;
    const untouched = () => albumTitleApplies({ href: hrefs[slot], title: objects[slot].value }, href);
    const offer = () => {
      if (untouched()) note(`Exhibit ${filled} keeps its ${provider} link and preview. Type its title, or search for it.`);
    };
    try {
      const found = apple
        ? await lookupAppleAlbum(href, controller.signal)
        : await lookupSpotifyAlbumTitle(href, controller.signal);
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
      note(`Exhibit ${filled} is ${label}. Its ${provider} link and preview stay.`);
      update();
    } catch {
      if (pendingLookups.get(slot) !== controller) return;
      pendingLookups.delete(slot);
      offer();
    }
  }

  /** One search of the active kind. The album fallback passes wikiAlbums to
   * run the exact current term through the same Wikidata catalogue instead —
   * same two-request shape, same abort and run-token protections, never
   * automatic. */
  async function runSearch(wikiAlbums = false) {
    const query = entry(music.query.value, 80);
    if (query.length < 2) {
      note("Enter at least two characters to search.");
      music.query.focus();
      return;
    }
    const country = music.country.value;
    const store = storeName();
    const requestedKind: SourceKind = kind;
    const wiki = wikiAlbums || requestedKind === "film" || requestedKind === "series"
      || requestedKind === "game";
    const kindLabel =
      requestedKind === "album" ? "albums" : requestedKind === "song" ? "songs"
      : requestedKind === "book" ? "books" : requestedKind === "app" ? "apps"
      : requestedKind === "film" ? "films" : requestedKind === "series" ? "TV series" : "games";
    // Games alone carry the platform filter, read from the selector beside the
    // Games button. All is the original search; any other kind always uses All.
    const platform: GamePlatformFilter = requestedKind === "game"
      ? music.platform.value === "pc" ? "pc" : music.platform.value === "console" ? "console" : "all"
      : "all";
    const gameFilter = requestedKind === "game" && platform !== "all";
    const searchLabel = gameFilter ? platform === "pc" ? "PC games" : "console games" : kindLabel;
    // Books and apps have no music-service fallback; weak, empty and failed
    // searches keep them straight to the retry message. Album searches keep
    // their Apple/Spotify links and the explicit Wikidata-album action.
    const offerRecovery = () => {
      if (requestedKind !== "book" && requestedKind !== "app") {
        showRecovery(query, country, wiki && !wikiAlbums, requestedKind === "album");
      }
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
      : wiki ? `Searching Wikidata ${searchLabel} for “${query}”…`
      : `Searching ${store} ${kindLabel} for “${query}”…`);
    try {
      const picks = requestedKind === "book"
        ? await searchBooks(query, country, controller.signal)
        : requestedKind === "app"
        ? await searchApps(query, country, controller.signal)
        : wikiAlbums
        ? await searchWikidata(query, "album", controller.signal)
        : requestedKind === "film" || requestedKind === "series" || requestedKind === "game"
        ? await searchWikidata(query, requestedKind, controller.signal, platform)
        : await searchMusic(query, requestedKind, country, controller.signal);
      if (run !== searchRun || controller.signal.aborted) return;
      const usable = picks.filter((pick) => pick && typeof pick.title === "string" && sourceLink(pick.href));
      if (!usable.length) {
        note(wikiAlbums
          ? `No albums matched “${query}” on Wikidata. Coverage is partial — search again with a shorter title, or paste an Apple Music, Spotify or Wikidata link.`
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
    if (profile) profile.value = draft.profile ?? "";
    if (profileStatus) profileStatus.textContent = "";
    chooseSkin.value = String(draft.skin ?? 0);
    rankedBox.checked = draft.ranked === true;
    discardMove();
    discardFill();
    cancelLookup();
    closePreview(false);
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
    if (preset.value === "Nine albums I took everywhere") {
      music.panel.open = true;
      music.query.focus();
    }
    update();
  });

  /** One swap keeps an exhibit's title, canonical source link and local cover together. */
  function swapExhibits(from: number, to: number) {
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

  function moveExhibit(to: number) {
    const from = Number(order.value);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= objects.length || to < 0 || to >= objects.length || from === to) return;
    swapExhibits(from, to);
    rememberMove(from, to);
    draftStatus.textContent = `Exhibit ${from + 1} moved to slot ${to + 1}. Undo last move is in the Move controls.`;
  }

  elements<HTMLButtonElement>(root, "[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveExhibit(Number(order.value) + Number(button.dataset.move)));
  });
  order.addEventListener("change", updateSwapButton);
  swapTarget.addEventListener("change", updateSwapButton);
  swapSlots.addEventListener("click", () => moveExhibit(Number(swapTarget.value)));
  undoMove.addEventListener("click", () => {
    if (!lastMove) return;
    const { from, to } = lastMove;
    swapExhibits(to, from);
    discardMove();
    order.focus({ preventScroll: true });
    draftStatus.textContent = `Move undone. Exhibit ${from + 1} is back in slot ${from + 1}.`;
  });

  /** Slots a pasted list may claim: no visible title and no staged source
   * link, page or cover, so a fill never takes over someone else's attachment. */
  function hasExhibitAttachment(index: number) {
    return Boolean(hrefs[index] || livePage(index) || covers[index]);
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
    if (!plan.lines.length) {
      list.status.textContent = "Paste at least one exhibit title, one per line.";
      list.text.focus();
      return;
    }
    if (!plan.indexes.length) {
      list.status.textContent = nineListSummary(plan, open.length);
      return;
    }
    plan.indexes.forEach((index, line) => setExhibit(index, plan.titles[line]));
    lastFill = { indexes: plan.indexes.slice(), titles: plan.titles.slice() };
    list.undo.disabled = false;
    // Overflow stays in the editor, recoverable for the next fill or an edit.
    list.text.value = plan.overflow.join("\n");
    list.status.textContent = nineListApplied(plan, listSlots().length);
    list.fill.disabled = planNineList(list.text.value, listSlots()).indexes.length === 0;
    if (objects[target]?.value.trim()) {
      const empty = firstEmpty();
      if (empty >= 0) target = empty;
      markTarget();
    }
  });
  /** One Undo reverses the whole fill: every slot still holding a line this
   * fill wrote is cleared, and those lines return to the paste box. A slot the
   * person has since edited keeps their text, and its line is not duplicated. */
  list.undo.addEventListener("click", () => {
    if (!lastFill) return;
    const filled = lastFill;
    const plan = planNineListUndo(filled, objects.map((input) => input.value), hasExhibitAttachment);
    plan.clear.forEach((index) => setExhibit(index, ""));
    const staying = listSlots().length;
    list.text.value = plan.restored.concat(
      list.text.value.split(/\r?\n/).filter((line) => line.trim()),
    ).join("\n");
    discardFill();
    const cleared = plan.clear.length;
    list.status.textContent = `Fill undone · ${cleared} exhibit${cleared === 1 ? "" : "s"} cleared · ${staying} empty slot${staying === 1 ? "" : "s"}${plan.kept ? ` · ${plan.kept} kept your later edit` : ""}.`;
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
   * only runs for the term that offered it. */
  music.recoveryAlbums.addEventListener("click", () => {
    if (kind !== "album" || entry(music.query.value, 80).length < 2) return;
    void runSearch(true);
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
        || next === "film" || next === "series" || next === "game" ? next : "album";
      music.kind.forEach((each) => each.setAttribute("aria-pressed", String(each.dataset.musicKind === kind)));
      // Films, TV series and games come from Wikidata, so the storefront does not apply.
      const wiki = kind === "film" || kind === "series" || kind === "game";
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
    target = Number(music.target.value);
    markTarget();
  });
  music.panel.addEventListener("toggle", () => {
    if (!music.panel.open) closePreview(false);
    markTarget();
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
    note(`Exhibit ${filled} has a ${source.provider} link. ${typed ? "Its title stays as you typed it." : "Add its title."}`);
    update();
    // Only an empty exhibit needs a title; one deliberate Apple Music or
    // Spotify album paste gets one bounded exact-ID lookup after the link and
    // preview exist.
    if (!typed) void fillAlbumTitle(slot, source.href);
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

  saveDraft.addEventListener("click", () => {
    const outcome = writeNineDraft(storage, {
      title: title.value,
      subtitle: subtitle.value,
      items: objects.map((input) => input.value),
      byline: byline.value,
      profile: profile?.value,
      skin: Number(chooseSkin.value),
      ranked: rankedBox.checked ? true : undefined,
      hrefs: hrefs.slice(),
      pages: objects.map((_, index) => livePage(index)),
    });
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
    draftStatus.textContent = "Saved draft cleared from this device. Your exhibition is still here.";
  });

  markTarget();
  refreshLinks();
  markCoverTarget();
  markPageTarget();
  renderCovers();
  showListCount();
  renderPreview();
  if (previewGrid) previewGrid.hidden = false;

  return {
    result: () => {
      const items = objects.map((input) => entry(input.value, 54));
      const heading = entry(title.value, 72);
      if (!heading || !items.every(Boolean)) return null;
      const line = entry(subtitle.value, nineSubtitleLimit);
      const links = hrefs.some(Boolean) ? hrefs.slice() : undefined;
      const pageOut = objects.map((_, index) => livePage(index));
      const profileHref = profile ? profileUrl(profile.value) : null;
      return {
        title: heading, items,
        ...(line ? { subtitle: line } : {}),
        ...(links ? { hrefs: links } : {}),
        ...(pageOut.some(Boolean) ? { pages: pageOut } : {}),
        ...(profileHref ? { profile: profileHref } : {}),
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
      rankedBox.checked = snapshot.ranked === true;
      // A shared hash is untrusted input: only a validated HTTPS profile
      // address restores, and an unsafe one leaves the field empty.
      if (profile) profile.value = profileUrl(snapshot.profile) ?? "";
      if (profileStatus) profileStatus.textContent = "";
      discardMove();
      discardFill();
      cancelLookup();
      closePreview(false);
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
}

function mountThisOrThat(root: HTMLElement, update: () => void): Controller {
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
  const blank = root.querySelector<HTMLElement>("[data-tot-blank]")!;
  const blankCopy = root.querySelector<HTMLButtonElement>("[data-tot-blank-copy]")!;
  const blankManual = root.querySelector<HTMLInputElement>("[data-tot-blank-manual]")!;
  const blankStatus = root.querySelector<HTMLElement>("[data-tot-blank-status]")!;
  let blankCopyAttempt = 0;
  const restart = root.querySelector<HTMLButtonElement>("[data-restart]")!;
  const customPanel = root.querySelector<HTMLDetailsElement>("[data-tot-custom]")!;
  const customForm = root.querySelector<HTMLFormElement>("[data-tot-custom-form]")!;
  const customStatus = root.querySelector<HTMLElement>("[data-custom-status]")!;
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
  /** The written set now on stage — five or nine — or null while a built-in
   * starter plays. Built-in starters are always the authored five. */
  let custom: readonly (readonly [string, string, string])[] | null = null;
  /** The length the editor is writing for. Five is the default; nine is the
   * one optional authored length. Switching it edits only the editor. */
  let customLength: ThisOrThatLength = thisOrThatCount;
  /** The editor's photo drafts, one per row. A cleared or replaced photo only
   * changes this draft; the applied snapshot below owns its own URLs. */
  let photoRows: DraftPhotoRow[] = Array.from({ length: 9 }, () => ({ photo: null, run: 0 }));
  /** Photos frozen into the active written run, with their own object URLs so
   * replacing or clearing an editor photo cannot break what is playing. */
  let appliedPhotos: (ThisOrThatPromptPhoto | null)[] = [];

  /** The questions the stage is currently asking, written or built-in. */
  const activeQuestions = () => custom ?? thisOrThatPacks[pack].questions;

  /** Retire the played run's photo URLs; the editor's copies stay untouched. */
  function releaseAppliedPhotos() {
    for (const photo of appliedPhotos) if (photo) URL.revokeObjectURL(photo.url);
    appliedPhotos = [];
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

  /** Swapping starters only retexts the panels it will ask: one controller, the
   * same choice, undo, focus and replay behaviour, no second quiz. */
  function applyPack(next: ThisOrThatPack) {
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
      // Panels beyond this run — the nine-panel tail during any five — stay
      // hidden with whatever text they hold until a longer run retexts them.
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
    const at = () => Math.max(0, photoRows.indexOf(row));
    const say = (text: string) => {
      const status = customPhotoStatuses[at()];
      if (row.run === run && status) status.textContent = text;
    };
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
    if (thisOrThatComplete(picks, activeQuestions().length)) showReveal(focus);
    else showQuestion(thisOrThatProgress(picks).question - 1, focus);
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

  // The length selector edits only the editor: five rows or nine, every typed
  // row keeps its draft in both directions, and nothing validates or plays
  // until "Play my questions" says so.
  lengthSelect.addEventListener("change", () => {
    applyLength(restoreThisOrThatLength(lengthSelect.value));
    customStatus.textContent = `Editing ${customLength} questions. Everything you typed is kept.`;
  });

  // One optional photo per written question. The trigger opens the native
  // picker, the file is checked before any decode, and a bad pick leaves the
  // row's previous photo exactly as it was.
  customPhotoPicks.forEach((button, index) => {
    button.addEventListener("click", () => customPhotos[index]?.click());
  });
  customPhotos.forEach((input, index) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      const row = photoRows[index];
      if (file && row) void choosePhoto(row, file);
    });
  });
  customPhotoClears.forEach((button, index) => {
    button.addEventListener("click", () => {
      const row = photoRows[index];
      if (!row) return;
      row.run += 1; // a decode still arriving must not undo this clear
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = null;
      const alt = customPhotoAlts[index];
      if (alt) alt.value = "";
      if (customPhotoStatuses[index]) {
        customPhotoStatuses[index].textContent = `Photo removed from question ${index + 1}.`;
      }
      renderPhotoRow(index);
      customPhotoPicks[index]?.focus({ preventScroll: true });
    });
  });
  customPhotoAlts.forEach((alt, index) => {
    alt.addEventListener("input", () => renderPhotoRow(index));
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

  restart.addEventListener("click", () => {
    // Replay keeps the run on stage: a written nine replays nine questions,
    // a written five or a built-in starter replays five.
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

  /** A written set never persists: it lives in the editor's own inputs, plays
   * only through this explicit action, and retexting the stage is all it
   * takes — the same panels, the same run, nothing sent anywhere. */
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
      if (row.photo) URL.revokeObjectURL(row.photo.url);
      row.photo = null;
    });
  });

  return {
    result: () => {
      const summary = thisOrThatSummary(picks, activeQuestions(), heading);
      // The PNG lists the exact chosen texts of the run on stage — five for a
      // built-in starter, five or nine for a written set — as rows; sides and
      // the starter travel in the link so it reopens the same run. Image
      // marking is Bingo-only, and a written set carries no pack at all — it
      // never travels in a link, so prompts and answers stay in this tab.
      return summary
        ? { title: heading, items: [...summary.items], marked: [...summary.sides], ...(custom ? {} : { pack }) }
        : null;
    },
    linksAllowed: () => custom === null,
    restore(snapshot) {
      const sides = restoreThisOrThatPicks(snapshot.marked);
      const title = entry(snapshot.title, 72);
      if (!sides || !title) return;
      applyPack(restoreThisOrThatPack(snapshot.pack));
      picks = sides;
      heading = title;
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
  // One invite action for the built-in game, wherever the summary is shown.
  const blankCopy = root.querySelector<HTMLButtonElement>("[data-tq-blank-copy]")!;
  const blankManual = root.querySelector<HTMLInputElement>("[data-tq-blank-manual]")!;
  const blankStatus = root.querySelector<HTMLElement>("[data-tq-blank-status]")!;
  let blankCopyAttempt = 0;
  const restarts = elements<HTMLButtonElement>(root, "[data-restart]");
  const finishes = elements<HTMLButtonElement>(root, "[data-tq-finish]");
  const customPanel = root.querySelector<HTMLDetailsElement>("[data-tq-custom]")!;
  const customForm = root.querySelector<HTMLFormElement>("[data-tq-custom-form]")!;
  const customPrompts = root.querySelector<HTMLTextAreaElement>("[data-tq-custom-prompts]")!;
  const customStatus = root.querySelector<HTMLElement>("[data-tq-custom-status]")!;
  const customReset = root.querySelector<HTMLButtonElement>("[data-tq-custom-reset]")!;
  let answers = twentyOneStart();
  let current = 0;
  let view: "questions" | "done" | "summary" = "questions";
  /** The prompts this run asks. Only Apply or Reset changes them, so the
   * editor stays a draft and an active run is never retexted mid-answer. */
  let activeQuestions: readonly string[] = twentyOneQuestions;
  /** Whether the active set differs from the built-in starter, for the quiet
   * progress marker. */
  let authored = false;

  /** An invite belongs to one summary view. Leaving it, replaying or applying
   * a set retires any visible fallback field and an in-flight clipboard write. */
  function clearBlankOffer() {
    blankCopyAttempt += 1;
    blankManual.hidden = true;
    blankManual.value = "";
    blankStatus.textContent = "";
  }

  function syncProgress() {
    const answered = twentyOneAnswered(answers);
    const source = authored ? " · your prompts" : "";
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
    summaryTitle.textContent = twentyOneResultTitle;
    list.replaceChildren();
    const pairs = twentyOnePairs(answers, activeQuestions);
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

  // The invite is the bare built-in route on this origin: no answer, result,
  // byline, authored prompt or saved state travels with it. No result link is
  // created, and an authored set still never becomes one of its own.
  blankCopy.addEventListener("click", async () => {
    if (view !== "summary") return;
    const href = new URL(twentyOneBlankPath, location.origin).href;
    clearBlankOffer();
    const attempt = blankCopyAttempt;
    try {
      await navigator.clipboard.writeText(href);
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = authored
        ? "Built-in starter link copied. Your edited questions and answers stay in this tab."
        : "Built-in starter link copied. It opens the built-in 21 questions with no answers.";
    } catch {
      if (attempt !== blankCopyAttempt) return;
      blankStatus.textContent = "Clipboard access was denied. Copy the built-in starter link from this field.";
      blankManual.value = href;
      blankManual.hidden = false;
      blankManual.focus();
      blankManual.select();
    }
  });

  restarts.forEach((button) => button.addEventListener("click", () => {
    // A replay asks the run’s active prompts again — written or built-in —
    // with fresh answers, until Reset returns to the built-in starter.
    answers = twentyOneStart();
    showQuestion(0, true);
    update();
  }));

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
  function applyPrompts(prompts: readonly string[]) {
    activeQuestions = [...prompts];
    authored = activeQuestions.some((prompt, index) => prompt !== twentyOneQuestions[index]);
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

  customReset.addEventListener("click", () => applyPrompts(twentyOneQuestions));

  showQuestion(0, false);

  return {
    // The card snapshot freezes the answers and the exact ordered prompts the
    // run asked. Preview and both formats draw from this one copy.
    result: () => view !== "summary" || twentyOneAnswered(answers) === 0
      ? null
      : { title: twentyOneResultTitle, items: [...answers], questions: [...activeQuestions] },
    // Private answers never become a public link: URL sharing stays off for
    // the whole run, with the downloaded cards as the way out.
    linksAllowed: () => false,
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
    archetype.textContent = outcome.archetype;
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

  /** Put exactly the validated, cleaned draft text back in the editor. */
  function fillDraftEditor(next: PersonaDraft) {
    draftTitle.value = next.title;
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
    const read = readPersonaDraft(draftTitle.value, editorRows(), pack.questions.length);
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
    const read = readPersonaDraft(draftTitle.value, editorRows(), pack.questions.length);
    if (!read.draft) {
      draftFileStatus.textContent = draftGapMessage(read.gap);
      focusDraftGap(read.gap);
      return;
    }
    const text = writePersonaDraftFile(pack.game, read.draft);
    // Read the exact bytes back before handing them over, so the downloaded
    // file is the same bounded, answer-free shape an import accepts.
    const checked = readPersonaDraftFile(pack.game, text, pack.questions.length);
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
      const read = readPersonaDraftFile(pack.game, text, pack.questions.length);
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

/** The visible text of a This-or-That text-only PNG: its title, optional
 * byline and every chosen option in question order. Prompts, unchosen sides,
 * private photo descriptions and links never reach the export or clipboard. */
function thisOrThatAltText(snapshot: ShareExperienceResult): string {
  const title = cleanText(snapshot.title, 72);
  const byline = cleanText(snapshot.byline, 48);
  const items = (snapshot.items ?? []).map((item) => cleanText(item, customThisOrThatOptionLimit));
  if (!title || (items.length !== 5 && items.length !== 9) || items.some((item) => !item)) return "";
  return [title, ...(byline ? [`By ${byline}`] : []), ...items]
    .map((line) => (/[.!?…]$/.test(line) ? line : `${line}.`))
    .join(" ");
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
  let controller: Controller;
  let altCopyAttempt = 0;
  const cardDownloads = root.querySelector<HTMLElement>("[data-tq-downloads]");
  const cardUrls: string[] = [];
  let cardVersion = 0;
  function clearCardDownloads() {
    if (!cardDownloads) return;
    cardVersion += 1;
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
    const canShare = Boolean(controller.result());
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
    download.disabled = busy || !canShare || !exportable;
    if (copyPng) copyPng.disabled = busy || !canShare || !exportable;
    copy.disabled = !links || !canShare || !exportable;
    if (alt) alt.disabled = !canShare || !exportable;
    nativeShare.disabled = !links || !canShare || !exportable || sharing;
    clearAltFallback();
    if (shareNote && game === "this-or-that") shareNote.textContent = links
      ? shareNoteBuiltin
      : "Links and sharing are off for your own questions. Download the text-only image to keep the choices — photos stay in this tab.";
    if (!exportable) status.textContent = "";
    else if (!canShare && game === "top-nine") status.textContent = "Enter a title and nine exhibits to share.";
    else if (!canShare && game === "this-or-that") status.textContent = links
      ? "Answer every question to share your result."
      : "Answer every question to download your result.";
    else if (!canShare && game === "twenty-one-questions") {
      status.textContent = "";
    } else if (!canShare && persona) {
      status.textContent = "Answer all eight questions to make your result card.";
    } else if (!canShare) status.textContent = "Find an ending to share.";
    else status.textContent = "";
  };
  const pickSkin = () => { root.dataset.skin = chooseSkin.value; };
  controller = game === "pick-a-door" ? mountDoor(root, update)
    : game === "top-nine" ? mountNine(root, update, byline, chooseSkin, pickSkin)
    : game === "this-or-that" ? mountThisOrThat(root, update)
    : game === "twenty-one-questions" ? mountTwentyQuestions(root, update)
    : persona ? mountPersona(root, update, persona)
    : mountBingo(root);
  chooseSkin.addEventListener("change", () => {
    pickSkin();
    if (cardDownloads || personaPreview) update();
  });
  if (cardDownloads || personaPreview) {
    // Changing format retires the old set at once: update() revokes its links
    // and bumps the version, so a render already in flight from the previous
    // format cannot append its downloads to the new choice.
    format?.addEventListener("change", update);
    byline.addEventListener("input", update);
    window.addEventListener("pagehide", () => {
      clearCardDownloads();
      clearPersonaPreview();
    });
  }

  // Twenty-one questions never produces result links, and a persona result
  // link is the answer-free `#result=<id>` fragment the quiz reads itself:
  // neither is the generic JSON snapshot, so a crafted hash restores nothing.
  const shared = game === "twenty-one-questions" || game === "developer-type" || game === "language-type"
    ? { snapshot: null as Record<string, unknown> | null, invalid: false }
    : sharedResult(game);
  if (shared.snapshot) {
    const snapshot = shared.snapshot;
    const skin = snapshot.skin;
    chooseSkin.value = skin === 1 || skin === 2 ? String(skin) : "0";
    byline.value = entry(snapshot.byline, 48);
    controller.restore(snapshot);
    pickSkin();
  } else if (shared.invalid) {
    status.textContent = "This result link could not be read. You can still start a new one.";
  }
  controller.resumeDraft?.(Boolean(shared.snapshot));
  update();

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
    if (!snapshot || busy || controller.exportAllowed?.() === false) return;
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
        const blob = await renderPersonaCard(cardCopy, cardFormat, {
          byline: entry(byline.value, 48),
          skin: Number(chooseSkin.value),
          game,
          label: persona.cardLabel,
          credit: persona.cardCredit,
        });
        const current = personaAttempt === personaVersion;
        busy = false;
        update();
        if (!current || !personaPreview) return;
        const href = URL.createObjectURL(blob);
        personaUrls.push(href);
        const figure = document.createElement("figure");
        figure.className = "tq-card";
        const preview = document.createElement("img");
        preview.className = "tq-card-preview";
        preview.src = href;
        preview.alt = `Your ${persona.stageLabel} result card: ${cardCopy.archetype}, ${cardCopy.subject}. ${cardFormat} preview.`;
        const meta = document.createElement("figcaption");
        meta.className = "tq-card-meta";
        const link = document.createElement("a");
        link.className = "button secondary";
        link.href = href;
        link.download = `${game}-${outcome}-${cardFormat}.png`;
        link.textContent = `Save ${cardFormat} PNG`;
        meta.append(link);
        if (imageClipboard) {
          // Copy the very Blob behind this preview and Save link, not a new
          // render or its URL. The version fixes which result the card holds;
          // update() clears this figure on a changed format, style, byline,
          // revise or retake, so a stale card can never reach the clipboard.
          const version = personaVersion;
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
        cards.forEach((blob, index) => {
          // One Blob URL per card feeds both the preview and its save link, so
          // the PNG a creator inspects is the exact file the link downloads.
          const href = URL.createObjectURL(blob);
          cardUrls.push(href);
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
          link.download = `${game}-${prefix}card-${index + 1}-of-${cards.length}.png`;
          link.textContent = `Save card ${index + 1} of ${cards.length}`;
          meta.append(link);
          figure.append(preview, meta);
          cardDownloads.append(figure);
        });
        cardDownloads.hidden = false;
        status.textContent = cards.length === 1 ? "Your card is ready." : "Your cards are ready.";
        return;
      }
      const blob = await renderExperienceResult(drawn, size, controller.exportCovers?.() ?? undefined);
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
      const png = renderExperienceResult(drawn, size, controller.exportCovers?.() ?? undefined);
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

  /** The same completed export snapshot the image is drawn from, reduced to
   * the text it prints: no links, covers or file detail reach the clipboard. */
  alt?.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot) return;
    const text = game === "this-or-that" ? thisOrThatAltText(snapshot) : topNineAltText({
      title: snapshot.title, subtitle: snapshot.subtitle, byline: snapshot.byline, items: snapshot.items ?? [],
      ranked: snapshot.ranked === true,
    });
    if (!text) {
      status.textContent = game === "this-or-that"
        ? "Answer every question to describe your result for alt text."
        : "Enter a title and nine exhibits to describe them for alt text.";
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

  // Twenty-one questions has no result link to hand over, and a persona result
  // hands its answer-free link over in the result panel instead. The native
  // share sheet stays off for all of them.
  if (typeof navigator.share === "function" && game !== "twenty-one-questions" && !persona) {
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
