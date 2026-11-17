import type { ShareFeedback } from "../lib/share-feedback.ts";

const feedbackApi = "/api/share-feedback";

export function mountArtworkActions(piece: HTMLElement) {
  const copy = piece.querySelector<HTMLButtonElement>("[data-gallery-copy]");
  if (copy) {
    copy.hidden = false;
    copy.addEventListener("click", async () => {
      const link = new URL(copy.dataset.galleryCopy!, location.origin).href;
      const status = piece.querySelector<HTMLElement>(
        "[data-gallery-copy-status]",
      )!;
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = "Link copied.";
      } catch {
        const fallback = piece.querySelector<HTMLInputElement>(
          "[data-gallery-copy-fallback]",
        )!;
        fallback.hidden = false;
        fallback.value = link;
        fallback.select();
        status.textContent = "Copy the selected link.";
      }
    });
  }

  const share = piece.querySelector<HTMLButtonElement>("[data-gallery-native]");
  if (share && navigator.share) {
    share.hidden = false;
    share.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: piece.querySelector("h1")?.textContent ?? "Share artwork",
          url: new URL(share.dataset.galleryNative!, location.origin).href,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          piece.querySelector<HTMLElement>(
            "[data-gallery-copy-status]",
          )!.textContent = "Use Copy link to share this artwork.";
      }
    });
  }

  const review = piece.querySelector<HTMLDetailsElement>(
    "[data-artwork-review]",
  );
  if (!review) return;
  const form = review.querySelector<HTMLFormElement>("form")!;
  const note = form.querySelector<HTMLTextAreaElement>("textarea")!;
  const vote = form.querySelector<HTMLFieldSetElement>("fieldset")!;
  const status = form.querySelector<HTMLElement>("[data-review-status]")!;
  const save = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const remove = form.querySelector<HTMLButtonElement>("[data-review-remove]")!;
  const retry = form.querySelector<HTMLButtonElement>("[data-review-retry]")!;
  const identity = {
    assetId: form.dataset.assetId!,
    revision: form.dataset.revision!,
  };
  let loaded = false;
  let busy = false;
  let existing: ShareFeedback | null = null;

  function show(item: ShareFeedback | null) {
    existing = item;
    for (const radio of vote.querySelectorAll<HTMLInputElement>("input"))
      radio.checked = radio.value === item?.vote;
    note.value = item?.note ?? "";
    remove.hidden = !item;
  }

  async function request(action?: "save" | "remove") {
    if (busy) return;
    const input = new FormData(form);
    busy = retry.disabled = remove.disabled = true;
    vote.disabled = note.disabled = save.disabled = true;
    status.textContent = action
      ? action === "save"
        ? "Saving…"
        : "Removing…"
      : "Loading your feedback…";
    try {
      const response = await fetch(
        action
          ? feedbackApi
          : `${feedbackApi}?${new URLSearchParams(identity)}`,
        {
          ...(action && {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              action === "save"
                ? {
                    ...identity,
                    action,
                    vote: input.get("vote"),
                    reasons: [],
                    note: input.get("note"),
                  }
                : { ...identity, action },
            ),
          }),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Feedback is unavailable.");
      loaded = true;
      retry.hidden = true;
      show(result.item);
      status.textContent =
        action === "save"
          ? "Private feedback saved."
          : action === "remove"
            ? "Feedback removed."
            : existing
              ? "You have saved feedback on this version."
              : "";
      if (action === "remove") save.focus();
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Feedback is unavailable. Try again.";
      retry.hidden = loaded;
    } finally {
      busy = retry.disabled = remove.disabled = false;
      vote.disabled = note.disabled = save.disabled = !loaded;
    }
  }

  review.addEventListener("toggle", () => {
    if (review.open && !loaded) void request();
  });
  retry.addEventListener("click", () => void request());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void request("save");
  });
  remove.addEventListener("click", () => void request("remove"));
}

function modified(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function mountMasonry(grid: HTMLElement) {
  const watched = new WeakSet<Element>();
  let frame = 0;
  function layout() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const style = getComputedStyle(grid);
      const columns = Number(style.getPropertyValue("--gallery-columns"));
      const gap = parseFloat(style.columnGap);
      const tiles = [...grid.querySelectorAll<HTMLElement>(".gallery-tile")];
      const width = (grid.clientWidth - gap * (columns - 1)) / columns;
      if (width <= 0) return;
      const heights = Array<number>(columns).fill(0);
      grid.dataset.masonry = "";
      for (const tile of tiles) tile.style.width = `${width}px`;
      const tileHeights = tiles.map(
        (tile) => tile.getBoundingClientRect().height,
      );
      for (const [index, tile] of tiles.entries()) {
        const column = heights.indexOf(Math.min(...heights));
        tile.style.insetInlineStart = `${column * (width + gap)}px`;
        tile.style.top = `${heights[column]}px`;
        heights[column] += tileHeights[index] + gap;
        if (!watched.has(tile)) {
          watched.add(tile);
          sizes.observe(tile);
        }
      }
      grid.style.height = `${Math.max(...heights) - gap}px`;
    });
  }
  const sizes = new ResizeObserver(layout);
  sizes.observe(grid);
  layout();
  return layout;
}

export function mountShareGallery(wall: HTMLElement) {
  const grid = wall.querySelector<HTMLElement>("[data-artwork-grid]");
  if (!grid) return;
  const dialog = wall.querySelector<HTMLDialogElement>(
    "[data-gallery-dialog]",
  )!;
  const content = dialog.querySelector<HTMLElement>("[data-gallery-content]")!;
  const close = dialog.querySelector<HTMLButtonElement>(
    "[data-gallery-close]",
  )!;
  const previous = dialog.querySelector<HTMLButtonElement>(
    "[data-gallery-prev]",
  )!;
  const next = dialog.querySelector<HTMLButtonElement>("[data-gallery-next]")!;
  const more = wall.querySelector<HTMLAnchorElement>("[data-artwork-next]");
  const status = wall.querySelector<HTMLElement>("[data-artwork-status]");
  const pages = more?.closest("nav");
  const resize = mountMasonry(grid);
  const seen = new Set(
    [...grid.querySelectorAll<HTMLElement>("[data-artwork-id]")].map(
      (tile) => tile.dataset.artworkId,
    ),
  );
  const loaded = new Set([location.href.split("#")[0]]);
  let opener: HTMLAnchorElement | null = null;
  let current: HTMLAnchorElement | null = null;
  let previewRequest: AbortController | null = null;
  let loading: Promise<boolean> | null = null;
  let moveFocus = false;

  const artworkLinks = () => [
    ...grid.querySelectorAll<HTMLAnchorElement>("[data-artwork-open]"),
  ];
  function arrows() {
    const links = artworkLinks();
    const index = current ? links.indexOf(current) : -1;
    previous.disabled = index < 1;
    next.disabled =
      index < 0 ||
      (index >= links.length - 1 && (!more || Boolean(more.hidden)));
  }

  async function loadBatch() {
    if (!more || more.hidden || !status) return false;
    observer?.unobserve(more);
    status.textContent = "Loading artwork…";
    try {
      const url = more.href;
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) throw Error("Artwork unavailable");
      const page = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const cards = [
        ...page.querySelectorAll<HTMLElement>(
          "[data-artwork-grid] [data-artwork-id]",
        ),
      ].filter((card) => {
        const id = card.dataset.artworkId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (!cards.length) throw Error("No new artwork");
      grid!.append(...cards);
      resize();
      if (moveFocus && document.activeElement === more)
        cards[0].querySelector<HTMLAnchorElement>("a")?.focus();
      loaded.add(url);
      const href = page
        .querySelector("[data-artwork-next]")
        ?.getAttribute("href");
      const following = href ? new URL(href, url) : null;
      if (
        following?.origin === location.origin &&
        following.pathname === "/share" &&
        !loaded.has(following.href)
      ) {
        more.href = following.href;
        observer?.observe(more);
      } else {
        more.hidden = true;
        pages?.removeAttribute("data-artwork-auto");
      }
      status.textContent = more.hidden
        ? "You’ve reached the end."
        : `${cards.length} more pieces loaded.`;
      arrows();
      return true;
    } catch {
      status.textContent =
        "Couldn’t load more here. Open the next page to try again.";
      more.dataset.navigate = "";
      pages?.removeAttribute("data-artwork-auto");
      return false;
    }
  }

  function load(explicit = false) {
    moveFocus ||= explicit;
    loading ??= loadBatch().finally(() => {
      loading = null;
      moveFocus = false;
    });
    return loading;
  }

  const observer = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) void load();
        },
        { rootMargin: "0px 0px 420px" },
      )
    : null;
  if (more) {
    if (observer) {
      pages?.setAttribute("data-artwork-auto", "");
      observer.observe(more);
    }
    more.addEventListener("click", (event) => {
      if (modified(event) || more.hasAttribute("data-navigate")) return;
      event.preventDefault();
      void load(true);
    });
  }

  async function show(
    link: HTMLAnchorElement,
    historyMode: "push" | "replace" | "restore",
  ) {
    previewRequest?.abort();
    const request = new AbortController();
    previewRequest = request;
    if (historyMode === "push") {
      opener = link;
      history.pushState({ shareArtwork: true }, "", new URL(link.href).pathname);
    } else if (historyMode === "replace") {
      history.replaceState({ shareArtwork: true }, "", new URL(link.href).pathname);
    } else if (!opener) {
      opener = link;
    }
    current = link;
    dialog.setAttribute(
      "aria-label",
      link.getAttribute("aria-label")?.replace(/^View /, "") ??
        "Artwork preview",
    );
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    arrows();
    if (
      (document.activeElement === next && next.disabled) ||
      (document.activeElement === previous && previous.disabled)
    )
      close.focus();
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = "Loading artwork…";
    content.replaceChildren(message);
    try {
      const response = await fetch(link.href, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
      });
      if (!response.ok) throw Error("Artwork unavailable");
      const page = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const piece = page.querySelector<HTMLElement>("[data-gallery-piece]");
      if (request.signal.aborted) return;
      if (!piece) throw Error("Artwork preview missing");
      // Use document-relative public links even while the gallery history
      // entry has the artwork's permanent URL.
      content.replaceChildren(piece);
      mountArtworkActions(piece);
    } catch {
      if (request.signal.aborted) return;
      message.textContent = "Couldn’t load the preview. ";
      const fallback = document.createElement("a");
      fallback.href = link.href;
      fallback.textContent = "Open artwork page";
      message.append(fallback);
    }
  }

  async function move(step: number) {
    if (!current) return;
    const from = current;
    let links = artworkLinks();
    const index = links.indexOf(from) + step;
    if (index === links.length && more && !more.hidden) {
      if (!(await load())) {
        const retry = document.createElement("a");
        retry.href = more.href;
        retry.textContent = "Continue to the next page";
        const message = document.createElement("p");
        message.setAttribute("role", "status");
        message.append("Couldn’t load the next artwork. ", retry);
        if (current === from && dialog.open) content.append(message);
        return;
      }
      links = artworkLinks();
    }
    if (current === from && dialog.open && links[index])
      await show(links[index], "replace");
  }

  grid.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      "[data-artwork-open]",
    );
    if (!link || modified(event)) return;
    event.preventDefault();
    void show(link, "push");
  });

  const dismiss = () => {
    if (history.state?.shareArtwork) history.back();
    else dialog.close();
  };
  close.addEventListener("click", dismiss);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });
  dialog.addEventListener("close", () => {
    previewRequest?.abort();
    current = null;
    opener?.focus({ preventScroll: true });
  });
  previous.addEventListener("click", () => void move(-1));
  next.addEventListener("click", () => void move(1));
  dialog.addEventListener("keydown", (event) => {
    if (
      (event.target as Element).closest(
        "input,textarea,select,[contenteditable]",
      )
    )
      return;
    if (event.key === "ArrowLeft" && !previous.disabled) {
      event.preventDefault();
      void move(-1);
    }
    if (event.key === "ArrowRight" && !next.disabled) {
      event.preventDefault();
      void move(1);
    }
  });
  window.addEventListener("popstate", (event) => {
    const link =
      event.state?.shareArtwork &&
      artworkLinks().find(
        (tile) => new URL(tile.href).pathname === location.pathname,
      );
    if (link) void show(link, "restore");
    else if (dialog.open) dialog.close();
  });
}
