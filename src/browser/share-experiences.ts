import {
  agentBingo, developerBingo, doorEndings, experiences, internetBingo,
  type ExperienceId,
} from "../lib/share-experiences.ts";
import {
  renderExperienceResult, resultSizes, type ResultFormat, type ShareExperienceResult,
} from "./share-experience-image.ts";
import {
  cleanText, clearNineDraft, readNineDraft, writeNineDraft,
  type DraftStorage, type NineDraft,
} from "../lib/share-experience-draft.ts";

interface ResultSnapshot {
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
}
interface Controller {
  result(): ResultSnapshot | null;
  restore(snapshot: Record<string, unknown>): void;
  resumeDraft?(protectShared: boolean): void;
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
  const storage: DraftStorage = (() => {
    try { return localStorage; } catch { return blockedStorage; }
  })();

  function applyDraft(draft: NineDraft) {
    title.value = draft.title;
    objects.forEach((input, index) => { input.value = draft.items[index] ?? ""; });
    byline.value = draft.byline ?? "";
    chooseSkin.value = String(draft.skin ?? 0);
    pickSkin();
    update();
  }

  root.addEventListener("input", update);
  preset.addEventListener("change", () => {
    if (preset.value) title.value = preset.value;
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
      order.value = String(to);
    });
  });

  saveDraft.addEventListener("click", () => {
    const outcome = writeNineDraft(storage, {
      title: title.value,
      items: objects.map((input) => input.value),
      byline: byline.value,
      skin: Number(chooseSkin.value),
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

  return {
    result: () => {
      const items = objects.map((input) => entry(input.value, 54));
      const heading = entry(title.value, 72);
      return heading && items.every(Boolean) ? { title: heading, items } : null;
    },
    restore(snapshot) {
      const items = snapshot.items;
      const heading = entry(snapshot.title, 72);
      if (heading && Array.isArray(items) && items.length === 9) {
        title.value = heading;
        objects.forEach((input, index) => { input.value = entry(items[index], 54); });
      }
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
  tiles.forEach((tile, index) => {
    tile.addEventListener("click", () => {
      if (index === 12) return;
      if (marked.has(index)) marked.delete(index);
      else marked.add(index);
      sync();
    });
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
  let busy = false;
  let controller: Controller;
  const update = () => {
    const canShare = Boolean(controller.result());
    download.disabled = busy || !canShare;
    copy.disabled = !canShare;
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

  download.addEventListener("click", async () => {
    const snapshot = result();
    if (!snapshot || busy) return;
    busy = true;
    update();
    status.textContent = "Preparing your image…";
    try {
      const size = Object.hasOwn(resultSizes, format.value) ? format.value as ResultFormat : "portrait";
      const blob = await renderExperienceResult(snapshot, size);
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
    const { background: _background, ...data } = snapshot;
    const url = new URL(location.pathname, location.origin);
    url.hash = new URLSearchParams({ result: JSON.stringify(data) }).toString();
    manual.hidden = true;
    manual.value = "";
    try {
      await navigator.clipboard.writeText(url.href);
      status.textContent = "Result link copied.";
    } catch {
      status.textContent = "Clipboard access was denied. Copy the address from this field.";
      manual.value = url.href;
      manual.hidden = false;
      manual.focus();
      manual.select();
    }
  });
}
