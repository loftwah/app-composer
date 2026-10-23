// Progressive enhancement only: the original app href and default navigation
// stay intact. One activation nonce is not a visitor or session identifier.
export function installStackActions(root: Document = document) {
  // Some engines expose a touch-generated click as a compatibility MouseEvent.
  // Keep only the immediately preceding input on the same link, in memory.
  let touch: { anchor: Element; at: number } | undefined;
  const input = (event: Event) => {
    if (!event.isTrusted) return;
    const anchor =
      event.target instanceof Element
        ? event.target.closest("a[data-outcome-instance]")
        : null;
    touch =
      anchor &&
      (event.type === "touchstart" ||
        ("pointerType" in event && event.pointerType === "touch"))
        ? { anchor, at: performance.now() }
        : undefined;
  };
  const keyboard = (event: KeyboardEvent) => {
    if (event.isTrusted) touch = undefined;
  };
  const activate = (event: MouseEvent) => {
    const parameters = new URL(root.URL).searchParams;
    if (
      parameters.getAll("analytics").includes("off") ||
      parameters.getAll("qa").includes("1")
    )
      return;
    if (
      !event.isTrusted ||
      event.defaultPrevented ||
      (event.type === "click" ? event.button !== 0 : event.button !== 1)
    )
      return;
    const anchor =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[data-outcome-instance]")
        : null;
    if (!anchor) return;
    const touched =
      touch?.anchor === anchor && performance.now() - touch.at < 1500;
    touch = undefined;
    const page = anchor.closest<HTMLElement>(
      "[data-outcome-slug][data-outcome-publication]",
    );
    const slug = page?.dataset.outcomeSlug,
      publicationKey = page?.dataset.outcomeKey,
      instance = anchor.dataset.outcomeInstance,
      publication = Number(page?.dataset.outcomePublication);
    if (
      !slug ||
      !instance ||
      !publicationKey ||
      !/^[a-f0-9]{64}$/.test(publicationKey) ||
      !Number.isSafeInteger(publication) ||
      publication < 1 ||
      !crypto.randomUUID
    )
      return;
    const interaction =
      touched || ("pointerType" in event && event.pointerType === "touch")
        ? "touch"
        : event.detail === 0
          ? "keyboard"
          : "pointer";
    const disposition =
      anchor.target === "_blank" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button === 1
        ? "new_tab"
        : "same_tab";
    try {
      void fetch(
        `/api/creator-actions/${encodeURIComponent(slug)}/${encodeURIComponent(instance)}`,
        {
          method: "POST",
          credentials: "omit",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract: 1,
            publication,
            publicationKey,
            token: crypto.randomUUID(),
            interaction,
            disposition,
          }),
        },
      ).catch(() => {});
    } catch {
      /* Unsupported keepalive or offline recording never owns navigation. */
    }
  };
  root.addEventListener("click", activate);
  root.addEventListener("auxclick", activate);
  root.addEventListener("pointerdown", input, { passive: true });
  root.addEventListener("touchstart", input, { passive: true });
  root.addEventListener("keydown", keyboard);
  return () => {
    root.removeEventListener("click", activate);
    root.removeEventListener("auxclick", activate);
    root.removeEventListener("pointerdown", input);
    root.removeEventListener("touchstart", input);
    root.removeEventListener("keydown", keyboard);
    touch = undefined;
  };
}
