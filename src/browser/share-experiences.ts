import {
  agentBingo, developerBingo, doorEndings, experiences, internetBingo,
  type ExperienceId,
} from "../lib/share-experiences.ts";
import {
  renderExperienceResult, resultSizes,
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
  musicPreview, searchMusic,
} from "../lib/top-nine-music.ts";
import {
  coverFileLimit, coverHeadLimit, coverPixelLimit, coverWorkingMax, sniffCover,
} from "../lib/top-nine-cover.ts";
import {
  normaliseSourceLinks, sourceLink,
  type SourceKind,
} from "../lib/top-nine-source.ts";
import type { CataloguePick } from "../lib/itunes-catalogue.ts";

interface ResultSnapshot {
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Canonical source links per exhibit; present only when at least one exists. */
  hrefs?: (string | null)[];
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
  const preset = root.querySelector<HTMLSelectElement>("[data-nine-preset]")!;
  const draftStatus = root.querySelector<HTMLElement>("[data-draft-status]")!;
  const saveDraft = root.querySelector<HTMLButtonElement>("[data-draft-save]")!;
  const openDraft = root.querySelector<HTMLButtonElement>("[data-draft-open]")!;
  const clearDraft = root.querySelector<HTMLButtonElement>("[data-draft-clear]")!;
  const music = {
    panel: root.querySelector<HTMLDetailsElement>("[data-music-panel]")!,
    target: root.querySelector<HTMLSelectElement>("[data-music-target-choice]")!,
    kind: elements<HTMLButtonElement>(root, "[data-music-kind]"),
    country: root.querySelector<HTMLSelectElement>("[data-music-country]")!,
    form: root.querySelector<HTMLFormElement>("[data-music-form]")!,
    query: root.querySelector<HTMLInputElement>("[data-music-query]")!,
    submit: root.querySelector<HTMLButtonElement>("[data-music-submit]")!,
    status: root.querySelector<HTMLElement>("[data-music-status]")!,
    results: root.querySelector<HTMLUListElement>("[data-music-results]")!,
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
  let previewIndex: number | null = null;
  let previewOpener: HTMLElement | null = null;

  const note = (text: string) => { music.status.textContent = text; };
  const coverNote = (text: string) => { cover.status.textContent = text; };
  const firstEmpty = () => objects.findIndex((input) => !input.value.trim());
  const storeName = () => music.country.selectedOptions[0]?.textContent?.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()
    || music.country.value;
  const yearOf = (value: unknown) => Number.isInteger(value) && Number(value) > 1900 && Number(value) < 3000 ? String(value) : "";
  const kindLabel = { png: "PNG", jpeg: "JPEG", webp: "WebP" } as const;

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
      const open: HTMLAnchorElement | HTMLButtonElement =
        source.provider === "Apple Books" ? document.createElement("a") : document.createElement("button");
      open.className = source.provider === "Apple Books" ? "button secondary" : "secondary";
      if (source.provider === "Apple Books") {
        (open as HTMLAnchorElement).href = source.href;
        (open as HTMLAnchorElement).target = "_blank";
        (open as HTMLAnchorElement).rel = "noopener noreferrer nofollow";
        open.textContent = "Open in Apple Books";
        open.setAttribute("aria-label", `Open the Apple Books link for exhibit ${index + 1} in a new tab`);
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
    hrefs[index] = href;
    if (previewIndex === index) closePreview(false);
    refreshLinks();
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
   * title on top, in the exhibition's own cell colours. */
  function renderPreview() {
    previewCells.forEach((cell, index) => {
      const slot = covers[index];
      const image = cell.querySelector<HTMLImageElement>("[data-nine-preview-cover]")!;
      const caption = cell.querySelector<HTMLElement>("[data-nine-preview-caption]")!;
      caption.textContent = objects[index].value.trim() || "—";
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

  function openPreview(index: number) {
    const preview = musicPreview(hrefs[index]);
    if (!preview) {
      note(hrefs[index]
        ? `Exhibit ${index + 1} has an Apple Books source link. Open it in Apple Books — books have no player here.`
        : `Exhibit ${index + 1} has no playable link.`);
      return;
    }
    previewIndex = index;
    previewOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = document.createElement("iframe");
    frame.src = preview.embedUrl;
    frame.title = `${preview.provider} player for exhibit ${index + 1}: ${entry(objects[index].value, 54) || "untitled"}`;
    frame.setAttribute("width", "100%");
    frame.height = previewHeight[preview.provider];
    frame.allow = "encrypted-media; fullscreen; picture-in-picture";
    frame.referrerPolicy = "no-referrer";
    music.previewFrame.replaceChildren(frame);
    music.previewTitle.textContent = `${preview.provider} preview · exhibit ${index + 1}`;
    music.previewSource.textContent = `Open in ${preview.provider}`;
    music.previewSource.href = preview.href;
    music.preview.hidden = false;
    music.previewTitle.focus();
  }

  /** One preview at a time: closing removes the frame so playback stops too. */
  function closePreview(restoreFocus = true) {
    previewIndex = null;
    music.previewFrame.replaceChildren();
    music.preview.hidden = true;
    music.previewSource.removeAttribute("href");
    if (restoreFocus && previewOpener?.isConnected) previewOpener.focus({ preventScroll: true });
    previewOpener = null;
  }

  function renderResults(picks: CataloguePick[]) {
    music.results.replaceChildren();
    picks.slice(0, 12).forEach((pick) => {
      const source = sourceLink(pick.href);
      const name = entry(pick.title, 80);
      if (!source || !name) return;
      const artist = entry(pick.artist, 60);
      const year = yearOf(pick.year);
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const heading = document.createElement("strong");
      heading.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = [artist, year, source.provider].filter(Boolean).join(" · ")
        || `Unlisted · ${source.provider}`;
      button.append(heading, detail);
      button.addEventListener("click", () => fillFromPick(pick));
      row.append(button);
      music.results.append(row);
    });
    music.results.hidden = !music.results.childElementCount;
  }

  function fillFromPick(pick: CataloguePick) {
    const source = sourceLink(pick.href);
    const name = entry(pick.title, 54);
    if (!source || !name) {
      note("That result has no usable Apple Music, Spotify or Apple Books link. Try another.");
      return;
    }
    const artist = entry(pick.artist, 48);
    const filled = target + 1;
    objects[target].value = entry(artist ? `${name} · ${artist}` : name, 54);
    setLink(target, source.href);
    const empty = firstEmpty();
    if (empty >= 0) target = empty;
    markTarget();
    note(`${name} added to exhibit ${filled}.${empty >= 0 ? ` Next pick fills exhibit ${target + 1}.` : ""}`);
    update();
  }

  async function runSearch() {
    const query = entry(music.query.value, 80);
    if (query.length < 2) {
      note("Enter at least two characters to search.");
      music.query.focus();
      return;
    }
    const country = music.country.value;
    const store = storeName();
    const requestedKind: SourceKind = kind;
    const kindLabel = requestedKind === "album" ? "albums" : requestedKind === "song" ? "songs" : "books";
    searching?.abort();
    const controller = new AbortController();
    searching = controller;
    const run = ++searchRun;
    music.submit.disabled = true;
    music.results.hidden = true;
    music.results.replaceChildren();
    note(`Searching ${store} ${kindLabel} for “${query}”…`);
    try {
      const picks = requestedKind === "book"
        ? await searchBooks(query, country, controller.signal)
        : await searchMusic(query, requestedKind, country, controller.signal);
      if (run !== searchRun || controller.signal.aborted) return;
      const usable = picks.filter((pick) => pick && typeof pick.title === "string" && sourceLink(pick.href));
      if (!usable.length) {
        note(`No ${kindLabel} matched “${query}” in ${store}. Try a shorter title, switch the type, change storefront, or paste a link.`);
        return;
      }
      renderResults(usable);
      note(`${usable.length === 1 ? "One result" : `${usable.length} results`}. Choose one to fill exhibit ${target + 1}.`);
    } catch {
      if (run !== searchRun || controller.signal.aborted) return;
      note("Search didn’t come back. Check your connection and try again, or paste an Apple Music, Spotify or Apple Books link below.");
    } finally {
      if (run === searchRun) {
        searching = null;
        music.submit.disabled = false;
      }
    }
  }

  function applyDraft(draft: NineDraft) {
    title.value = draft.title;
    objects.forEach((input, index) => { input.value = draft.items[index] ?? ""; });
    byline.value = draft.byline ?? "";
    chooseSkin.value = String(draft.skin ?? 0);
    closePreview(false);
    hrefs = normaliseSourceLinks(draft.hrefs);
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
  preset.addEventListener("change", () => {
    if (preset.value) title.value = preset.value;
    if (preset.value === "Nine albums I took everywhere") {
      music.panel.open = true;
      music.query.focus();
    }
    update();
  });
  elements<HTMLButtonElement>(root, "[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const from = Number(order.value);
      const to = from + Number(button.dataset.move);
      if (to < 0 || to >= objects.length) return;
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
      update();
    });
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
  function clearSearch() {
    searching?.abort();
    searchRun += 1;
    music.submit.disabled = false;
    music.results.hidden = true;
    music.results.replaceChildren();
    note("");
  }
  music.query.addEventListener("input", clearSearch);
  music.country.addEventListener("change", clearSearch);
  music.kind.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.musicKind;
      kind = next === "song" || next === "book" ? next : "album";
      music.kind.forEach((each) => each.setAttribute("aria-pressed", String(each.dataset.musicKind === kind)));
      clearSearch();
    });
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
      note("That isn’t an Apple Music, Spotify or Apple Books link. Copy the share link from its page in the app or store.");
      music.paste.focus();
      music.paste.select();
      return;
    }
    const typed = Boolean(objects[target].value.trim());
    const filled = target + 1;
    setLink(target, source.href);
    music.paste.value = "";
    if (typed) {
      const empty = firstEmpty();
      if (empty >= 0) target = empty;
      markTarget();
    }
    note(`Exhibit ${filled} has a ${source.provider} link. ${typed ? "Its title stays as you typed it." : "Add its title."}`);
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
      return { title: heading, items, ...(links ? { hrefs: links } : {}) };
    },
    exportCovers: () => (covers.some(Boolean) ? covers.map((slot) => slot?.art ?? null) : null),
    restore(snapshot) {
      const items = snapshot.items;
      const heading = entry(snapshot.title, 72);
      if (!heading || !Array.isArray(items) || items.length !== 9) return;
      title.value = heading;
      objects.forEach((input, index) => { input.value = entry(items[index], 54); });
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
  const format = root.querySelector<HTMLSelectElement>("[data-format]")!;
  const chooseSkin = root.querySelector<HTMLSelectElement>("[data-skin-select]")!;
  const byline = root.querySelector<HTMLInputElement>("[data-byline]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const download = root.querySelector<HTMLButtonElement>("[data-download]")!;
  const copy = root.querySelector<HTMLButtonElement>("[data-copy]")!;
  const manual = root.querySelector<HTMLInputElement>("[data-manual-copy]")!;
  const nativeShare = root.querySelector<HTMLButtonElement>("[data-share]")!;
  let busy = false;
  let sharing = false;
  let controller: Controller;
  const update = () => {
    const canShare = Boolean(controller.result());
    download.disabled = busy || !canShare;
    copy.disabled = !canShare;
    nativeShare.disabled = !canShare || sharing;
    if (!canShare && game === "top-nine") status.textContent = "Enter a title and nine exhibits to share.";
    else if (!canShare) status.textContent = "Find an ending to share.";
    else status.textContent = "";
  };
  const pickSkin = () => { root.dataset.skin = chooseSkin.value; };
  controller = game === "pick-a-door" ? mountDoor(root, update)
    : game === "top-nine" ? mountNine(root, update, byline, chooseSkin, pickSkin) : mountBingo(root);
  chooseSkin.addEventListener("change", pickSkin);
  const shared = sharedResult(game);
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
    status.textContent = "Preparing your image…";
    try {
      const size = Object.hasOwn(resultSizes, format.value) ? format.value as ResultFormat : "portrait";
      // Links belong to the interactive result and result link; the image stays text-only.
      const { hrefs: _links, ...drawn } = snapshot;
      // Covers are passed beside the snapshot, never inside it, so no link or
      // draft path can carry a person's photo bytes.
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
      status.textContent = "Couldn’t prepare the image. Try again, or copy the result link.";
    }
  });

  copy.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot) return;
    const href = resultLink(snapshot);
    manual.hidden = true;
    manual.value = "";
    try {
      await navigator.clipboard.writeText(href);
      status.textContent = "Result link copied.";
    } catch {
      status.textContent = "Clipboard access was denied. Copy the address from this field.";
      offerManualCopy(href);
    }
  });

  if (typeof navigator.share === "function") {
    nativeShare.hidden = false;
    nativeShare.addEventListener("click", async () => {
      if (sharing) return;
      const snapshot = result();
      if (!snapshot) return;
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
