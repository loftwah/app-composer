// Progressive enhancement only: the original app href and default navigation
// stay intact. One activation nonce is not a visitor or session identifier.
export function installStackActions(root: Document = document) {
  const activate = (event: MouseEvent) => {
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
    const page = anchor.closest<HTMLElement>(
      "[data-outcome-slug][data-outcome-publication]",
    );
    const slug = page?.dataset.outcomeSlug,
      instance = anchor.dataset.outcomeInstance,
      publication = Number(page?.dataset.outcomePublication);
    if (
      !slug ||
      !instance ||
      !Number.isSafeInteger(publication) ||
      publication < 1 ||
      !crypto.randomUUID
    )
      return;
    const interaction =
      event.detail === 0
        ? "keyboard"
        : "pointerType" in event && event.pointerType === "touch"
          ? "touch"
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
  return () => {
    root.removeEventListener("click", activate);
    root.removeEventListener("auxclick", activate);
  };
}
