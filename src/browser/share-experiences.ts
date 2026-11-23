import {
  agentBingo, developerBingo, doorEndings, experiences, internetBingo,
  thisOrThatPacks, twentyOneQuestions, twentyOneResultTitle,
  type ExperienceId, type ThisOrThatPack,
} from "../lib/share-experiences.ts";
import {
  pickThisOrThat, restoreThisOrThatPack, restoreThisOrThatPicks,
  customThisOrThatTitle, readThisOrThatCustom,
  thisOrThatBlankLink, thisOrThatComplete, thisOrThatPackFromQuery,
  thisOrThatProgress, thisOrThatStart, thisOrThatSummary, undoThisOrThat,
} from "../lib/this-or-that.ts";
import {
  moveTwentyOne, readTwentyOnePrompts, setTwentyOneAnswer, skipTwentyOne,
  twentyOneAnswered, twentyOneAnswerLimit, twentyOneBlankPath, twentyOneCount,
  twentyOnePairs, twentyOnePromptLimit, twentyOneStart,
} from "../lib/twenty-one-questions.ts";
import {
  renderExperienceCards, renderExperienceResult, resultSizes,
  type ResultCover, type ResultFormat, type ShareExperienceResult,
} from "./share-experience-image.ts";
import {
  cleanText, clearNineDraft, readNineDraft, writeNineDraft,
  type DraftStorage, type NineDraft,
} from "../lib/share-experience-draft.ts";
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
  coverFileLimit, coverHeadLimit, coverPixelLimit, coverWorkingMax, sniffCover,
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
  /** The frozen authored prompts a private 21-questions card export draws. */
  questions?: string[];
}

/** One cover a person picked from their device: session-only, never uploaded. */
interface CoverSlot {
  url: string;
  art: ResultCover;
  kind: "png" | "jpeg" | "webp";
}

interface Controller {
  result(): ResultSnapshot | null;
  restore(snapshot: Record<string, unknown>): void;
  resumeDraft?(protectShared: boolean): void;
  /** Decoded cover art for the downloaded image; never part of a shared result. */
  exportCovers?(): readonly (ResultCover | null)[] | null;
  /** Whether the current run may produce a result link at all. Absent means
   * yes; a written five never becomes one, so URL sharing stays off. */
  linksAllowed?(): boolean;
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
  const previewCells = elements<HTMLElement>(root, "[data-nine-preview-cell]");
  const storage: DraftStorage = (() => {
    try { return localStorage; } catch { return blockedStorage; }
  })();
  let hrefs: (string | null)[] = objects.map(() => null);
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

  function markTarget() {
    music.target.value = String(target);
    objects.forEach((input, index) => {
      const active = music.panel.open && index === target;
      input.closest("label")?.toggleAttribute("data-music-target", active);
      const marker = root.querySelector<HTMLElement>(`[data-exhibit-filling="${index}"]`);
      if (marker) marker.hidden = !active;
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
    hrefs.forEach((href, index) => {
      const source = sourceLink(href);
      objects[index].closest("label")?.toggleAttribute("data-has-link", Boolean(source));
      const state = root.querySelector<HTMLElement>(`[data-music-slot-state="${index}"]`);
      if (!state) return;
      state.hidden = !source;
      state.textContent = source ? `${source.provider} link` : "";
    });
    renderLinked();
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
      row.append(label, remove);
      cover.linked.append(row);
    });
    cover.linked.hidden = !cover.linked.childElementCount;
  }

  /** The in-page grid mirrors what the downloaded image will hang: cover first,
   * title on top, in the exhibition's own cell colours. An explicitly ranked
   * board also numbers every occupied slot here, exactly as the export does. */
  function renderPreview() {
    const ranked = rankedBox.checked;
    previewCells.forEach((cell, index) => {
      const slot = covers[index];
      const showRank = ranked && Boolean(objects[index].value.trim());
      const image = cell.querySelector<HTMLImageElement>("[data-nine-preview-cover]")!;
      const caption = cell.querySelector<HTMLElement>("[data-nine-preview-caption]")!;
      caption.textContent = objects[index].value.trim() || "—";
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
      if (!slot) {
        image.hidden = true;
        image.removeAttribute("src");
        return;
      }
      if (image.getAttribute("src") !== slot.url) image.src = slot.url;
      image.hidden = false;
    });
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
    covers[index] = { url, art, kind: sniffed.kind };
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
    objects.forEach((input, index) => { input.value = restoredItems[index]; });
    byline.value = draft.byline ?? "";
    chooseSkin.value = String(draft.skin ?? 0);
    rankedBox.checked = draft.ranked === true;
    discardMove();
    cancelLookup();
    closePreview(false);
    hrefs = restoredHrefs;
    if (hrefs.some(Boolean)) music.panel.open = true;
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
    [covers[from], covers[to]] = [covers[to], covers[from]];
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
  cover.target.addEventListener("change", () => {
    coverTarget = Number(cover.target.value);
    markCoverTarget();
  });
  cover.panel.addEventListener("toggle", markCoverTarget);
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
  objects.forEach((input, index) => {
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text")?.trim() ?? "";
      const source = sourceLink(text);
      if (!source) return;
      event.preventDefault();
      const typed = input.value.trim();
      setLink(index, source.href);
      if (!typed || /^https?:\/\//i.test(typed)) input.value = "";
      note(`Exhibit ${index + 1} has a ${source.provider} link. ${input.value.trim() ? "Its title stays as you typed it." : "Type its title, or search for it."}`);
      update();
    });
    input.addEventListener("input", () => {
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
      items: objects.map((input) => input.value),
      byline: byline.value,
      skin: Number(chooseSkin.value),
      ranked: rankedBox.checked ? true : undefined,
      hrefs: hrefs.slice(),
    });
    if (outcome === "saved") {
      openDraft.hidden = true;
      draftStatus.textContent = "Saved on this device. It opens next time you visit in this browser.";
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
  renderCovers();
  renderPreview();
  if (previewGrid) previewGrid.hidden = false;

  return {
    result: () => {
      const items = objects.map((input) => entry(input.value, 54));
      const heading = entry(title.value, 72);
      if (!heading || !items.every(Boolean)) return null;
      const links = hrefs.some(Boolean) ? hrefs.slice() : undefined;
      return {
        title: heading, items,
        ...(links ? { hrefs: links } : {}),
        ...(rankedBox.checked ? { ranked: true } : {}),
      };
    },
    exportCovers: () => (covers.some(Boolean) ? covers.map((slot) => slot?.art ?? null) : null),
    restore(snapshot) {
      const items = snapshot.items;
      const heading = entry(snapshot.title, 72);
      if (!heading || !Array.isArray(items) || items.length !== 9) return;
      title.value = heading;
      objects.forEach((input, index) => { input.value = entry(items[index], 54); });
      rankedBox.checked = snapshot.ranked === true;
      discardMove();
      cancelLookup();
      closePreview(false);
      hrefs = trimHrefs(snapshot.hrefs);
      if (hrefs.some(Boolean)) music.panel.open = true;
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
  let picks: (0 | 1 | null)[] = thisOrThatStart();
  let pack: ThisOrThatPack = "maker";
  let heading: string = thisOrThatPacks.maker.title;
  /** The written five now on stage, or null while a built-in starter plays. */
  let custom: readonly (readonly [string, string, string])[] | null = null;

  /** The five the stage is currently asking, written or built-in. */
  const activeQuestions = () => custom ?? thisOrThatPacks[pack].questions;

  /** Swapping starters only retexts the same five panels: one controller, the
   * same choice, undo, focus and replay behaviour, no second quiz. */
  function applyPack(next: ThisOrThatPack) {
    pack = next;
    const selected = thisOrThatPacks[pack];
    packSelect.value = pack;
    if (description) description.textContent = selected.description;
    retextPanels(selected.questions);
    heading = selected.title;
  }

  function retextPanels(questions: readonly (readonly [string, string, string])[]) {
    panels.forEach((panel, index) => {
      const [prompt, left, right] = questions[index];
      panel.querySelector("h2")!.textContent = prompt;
      // The group's accessible name is authored from the maker prompt; keep it
      // in step with the h2 so a swapped starter is announced by its real question.
      panel.querySelector<HTMLElement>("[data-tot-options]")?.setAttribute("aria-label", prompt);
      const buttons = panel.querySelectorAll<HTMLButtonElement>("[data-choice]");
      buttons[0].textContent = left;
      buttons[1].textContent = right;
    });
  }

  const answered = () => picks.filter((pick) => pick !== null).length;

  function syncProgress() {
    const state = thisOrThatProgress(picks);
    progress.textContent = thisOrThatComplete(picks)
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
    // The written five have no link to hand over; the note points at the download instead.
    if (revealNote) revealNote.textContent = custom
      ? "Every answer is yours — download your result image to keep it. Your own five never become a link."
      : revealNoteBuiltin;
    if (focus) revealTitle.focus({ preventScroll: true });
  }

  function advance(focus: boolean) {
    if (thisOrThatComplete(picks)) showReveal(focus);
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

  // One native selector swaps the five prompts in place. It never changes the
  // starter on first load, and replay keeps whichever starter is on screen.
  // "Your five" plays whatever the editor holds right now; an unusable editor
  // keeps the built-in starter and points at the row to fix.
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
  // the canonical path and, for the food starter, one exact pack parameter.
  // No fragment, result, byline, answers or other query travels. A written five
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
    picks = thisOrThatStart();
    heading = custom ? customThisOrThatTitle : thisOrThatPacks[pack].title;
    showQuestion(0, false);
    panels[0].querySelector<HTMLButtonElement>("[data-choice]")?.focus({ preventScroll: true });
    update();
  });

  /** A written five never persists: it lives in the editor's own inputs, plays
   * only through this explicit action, and retexting the stage is all it
   * takes — the same panels, the same run, nothing sent anywhere. */
  function playCustom(): boolean {
    const rows = customPrompts.map((prompt, index) =>
      [prompt.value, customLefts[index]?.value, customRights[index]?.value] as const);
    const read = readThisOrThatCustom(rows);
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
    custom = read.questions;
    picks = thisOrThatStart();
    heading = customThisOrThatTitle;
    packSelect.value = "custom";
    if (description) description.textContent = "You’re playing your own five. They stay in this tab.";
    retextPanels(custom);
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

  // A blank link may name one exact built-in starter for a fresh signed-out
  // visitor. A shared result fragment still restores its own picks and pack
  // after this first-load hint, so the fragment keeps precedence.
  applyPack(thisOrThatPackFromQuery(location.search));
  showQuestion(0, false);

  return {
    result: () => {
      const summary = thisOrThatSummary(picks, activeQuestions(), heading);
      // The PNG lists the five exact choices as rows; sides and the starter
      // travel in the link so it reopens the same run. Image marking is
      // Bingo-only, and a written five carries no pack at all — it never
      // travels in a link, so prompts and answers stay in this tab.
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
  if (location.hash.length > 10_000) return { snapshot: null, invalid: false };
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

export function mountShareExperience(root: HTMLElement) {
  const game = root.dataset.experience as ExperienceId;
  if (!Object.hasOwn(experiences, game)) return;
  const format = root.querySelector<HTMLSelectElement>("[data-format]");
  const chooseSkin = root.querySelector<HTMLSelectElement>("[data-skin-select]")!;
  const byline = root.querySelector<HTMLInputElement>("[data-byline]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const download = root.querySelector<HTMLButtonElement>("[data-download]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-copy]")!;
  const manual = root.querySelector<HTMLInputElement>("[data-manual-copy]")!;
  const alt = root.querySelector<HTMLButtonElement>("[data-copy-alt]");
  const altManual = root.querySelector<HTMLTextAreaElement>("[data-manual-alt]");
  const nativeShare = root.querySelector<HTMLButtonElement>("[data-share]")!;
  const shareNote = root.querySelector<HTMLElement>("[data-share-note]");
  const shareNoteBuiltin = shareNote?.textContent ?? "";
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
    clearCardDownloads();
    // A written This-or-That five never produces a link, so URL sharing is
    // switched off only while it is on stage, with the download as the way out.
    // Twenty-one questions never produces one at all: answers are private.
    const links = controller.linksAllowed?.() ?? true;
    if (!links) {
      manual.hidden = true;
      manual.value = "";
    }
    download.disabled = busy || !canShare;
    copy.disabled = !links || !canShare;
    if (alt) alt.disabled = !canShare;
    nativeShare.disabled = !links || !canShare || sharing;
    clearAltFallback();
    if (shareNote && game === "this-or-that") shareNote.textContent = links
      ? shareNoteBuiltin
      : "Links and sharing are off for your own five. Download the image to keep your result — your questions stay in this tab.";
    if (!canShare && game === "top-nine") status.textContent = "Enter a title and nine exhibits to share.";
    else if (!canShare && game === "this-or-that") status.textContent = links
      ? "Answer all five questions to share your result."
      : "Answer all five questions to download your result.";
    else if (!canShare && game === "twenty-one-questions") {
      status.textContent = "";
    } else if (!canShare) status.textContent = "Find an ending to share.";
    else status.textContent = "";
  };
  const pickSkin = () => { root.dataset.skin = chooseSkin.value; };
  controller = game === "pick-a-door" ? mountDoor(root, update)
    : game === "top-nine" ? mountNine(root, update, byline, chooseSkin, pickSkin)
    : game === "this-or-that" ? mountThisOrThat(root, update)
    : game === "twenty-one-questions" ? mountTwentyQuestions(root, update)
    : mountBingo(root);
  chooseSkin.addEventListener("change", () => {
    pickSkin();
    if (cardDownloads) update();
  });
  if (cardDownloads) {
    // Changing format retires the old set at once: update() revokes its links
    // and bumps cardVersion, so a render already in flight from the previous
    // format cannot append its downloads to the new choice.
    format?.addEventListener("change", update);
    byline.addEventListener("input", update);
    window.addEventListener("pagehide", clearCardDownloads);
  }

  // Twenty-one questions never produces result links, so a crafted hash is
  // not a shared result: nothing restores and the stage starts empty.
  const shared = game === "twenty-one-questions"
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
    if (!snapshot || busy) return;
    busy = true;
    update();
    status.textContent = cardDownloads ? "Preparing your cards…" : "Preparing your image…";
    const attempt = cardVersion;
    try {
      // Links belong to the interactive result and result link; the image stays text-only.
      const { hrefs: _links, ...drawn } = snapshot;
      const formatValue = format?.value;
      const size = formatValue && Object.hasOwn(resultSizes, formatValue) ? formatValue as ResultFormat : "portrait";
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
      status.textContent = cardDownloads
        ? "Couldn’t prepare the cards. Try again."
        : controller.linksAllowed?.() === false
          ? "Couldn’t prepare the image. Try again."
          : "Couldn’t prepare the image. Try again, or copy the result link.";
    }
  });

  copy.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || controller.linksAllowed?.() === false) return;
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
    const text = topNineAltText({
      title: snapshot.title, byline: snapshot.byline, items: snapshot.items ?? [],
      ranked: snapshot.ranked === true,
    });
    if (!text) {
      status.textContent = "Enter a title and nine exhibits to describe them for alt text.";
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

  // Twenty-one questions has no result link to hand over, so the native
  // share sheet stays off for it entirely.
  if (typeof navigator.share === "function" && game !== "twenty-one-questions") {
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
