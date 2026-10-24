// Counts describe public interactions, never completed operations or people.
import {
  resourceActionPayload,
  resourceTrafficExcluded,
  resourceQaLabel,
} from "../lib/resource-action-contract.ts";
export { resourceActionPayload } from "../lib/resource-action-contract.ts";

export function recordResourceAction(
  resource: unknown,
  action: unknown,
  url = location.href,
  send: typeof fetch = fetch,
) {
  const parameters = new URL(url).searchParams;
  if (resourceTrafficExcluded(parameters)) return;
  const payload = resourceActionPayload(resource, action);
  if (!payload) return;
  try {
    void send("/api/resource-actions", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Optional recording never blocks a download, clipboard or navigation.
  }
}

const installed = new WeakMap<Document, () => void>();
export function installResourceActions(root: Document = document) {
  installed.get(root)?.();
  const parameters = new URL(root.URL).searchParams;
  // Manual QA follows ordinary native links too. Only the two public exclusion
  // flags travel; unrelated page fields/query text never follow the visitor.
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>(
    ".resource-opening a:not([download]), .resource-workspace a:not([download])",
  )) {
    const target = new URL(anchor.href, root.URL);
    if (target.origin !== new URL(root.URL).origin) continue;
    if (resourceTrafficExcluded(parameters)) {
      // Invalid/empty QA labels still suppress recording after navigation.
      target.searchParams.set("analytics", "off");
      const label = resourceQaLabel(parameters);
      if (label) target.searchParams.set("qa", label);
      anchor.href = target.href;
    }
  }
  const activate = (event: MouseEvent) => {
    if (
      !event.isTrusted ||
      event.defaultPrevented ||
      (event.type === "click" ? event.button !== 0 : event.button !== 1)
    )
      return;
    const anchor =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>(
            "a[data-resource-action][data-resource-id]",
          )
        : null;
    if (!anchor) return;
    // Copy is recorded by the clipboard success path, never by its click.
    if (anchor.dataset.resourceAction === "copy") return;
    recordResourceAction(
      anchor.dataset.resourceId,
      anchor.dataset.resourceAction,
      root.URL,
    );
  };
  root.addEventListener("click", activate);
  root.addEventListener("auxclick", activate);
  const stop = () => {
    root.removeEventListener("click", activate);
    root.removeEventListener("auxclick", activate);
    installed.delete(root);
  };
  installed.set(root, stop);
  return stop;
}
