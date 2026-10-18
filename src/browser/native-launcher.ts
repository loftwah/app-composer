import { apps } from "../lib/apps";
import nativeStyles from "../styles/native-launcher.css?url";

type Controller = {
  open(search?: boolean): void;
  close(): void;
  dispose(): void;
};
type API = {
  version: 1;
  unmount(dialog: HTMLDialogElement): void;
  mount(options?: {
    dialog: HTMLDialogElement;
    trigger: HTMLButtonElement;
    assetBase: URL;
  }): Controller | null;
};
const shared = globalThis as typeof globalThis & {
  AppComposerLauncher?: API;
  composerNativeMenu?: { dispose(): void };
};
const nativePath = () => /^\/_emdash\/admin(?:\/|$)/.test(location.pathname);

async function install() {
  if (!nativePath() || shared.composerNativeMenu) return;
  const events = new AbortController();
  const container = document.createElement("div");
  container.className = "native-app-launcher app-launcher";
  container.setAttribute("data-native-composer-menu", "");
  const fallback = document.createElement("a");
  fallback.href = "/apps";
  fallback.className = "native-apps-trigger";
  fallback.textContent = "Apps";
  fallback.setAttribute("aria-label", "Browse apps");
  container.append(fallback);
  document.body.prepend(container);
  const ownedAssets: HTMLElement[] = [];
  let controller: Controller | null = null;
  let dialog: HTMLDialogElement | null = null;
  const initialKeys = new AbortController();
  let requestedSearch = false;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller?.dispose();
    if (dialog) shared.AppComposerLauncher?.unmount(dialog);
    initialKeys.abort();
    events.abort();
    container.remove();
    ownedAssets.forEach((asset) => asset.remove());
    delete shared.composerNativeMenu;
  };
  shared.composerNativeMenu = { dispose };
  // During one bounded asset/manifest load, reserve the same shortcut rather
  // than opening the host's unrelated palette. The controller replaces this.
  window.addEventListener(
    "keydown",
    (event) => {
      if (!(
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ))
        return;
      event.stopImmediatePropagation();
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      requestedSearch = true;
    },
    { capture: true, signal: initialKeys.signal },
  );
  window.addEventListener(
    "pagehide",
    (event) => {
      controller?.close();
      if (!event.persisted) dispose();
    },
    { signal: events.signal },
  );
  window.addEventListener("popstate", () => controller?.close(), {
    signal: events.signal,
  });
  function asset(tag: "link" | "script", href: string) {
    return new Promise<void>((resolve, reject) => {
      const node = document.createElement(tag);
      ownedAssets.push(node);
      if (node instanceof HTMLLinkElement) {
        node.rel = "stylesheet";
        node.href = href;
      } else {
        node.src = href;
        node.async = true;
      }
      const timeout = setTimeout(() => {
        node.remove();
        reject(Error("Native menu asset did not load."));
      }, 8000);
      events.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(Error("Native menu disposed."));
        },
        { once: true },
      );
      node.addEventListener(
        "load",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true, signal: events.signal },
      );
      node.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(Error("Native menu asset unavailable."));
        },
        { once: true, signal: events.signal },
      );
      document.head.append(node);
    });
  }
  const pages = async () => {
    try {
      const response = await fetch("/_emdash/api/manifest", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([events.signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) return [];
      const reader = response.body?.getReader();
      if (!reader) return [];
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 250000) {
          await reader.cancel();
          return [];
        }
        chunks.push(value);
      }
      const bytes = new TextDecoder().decode(
        new Uint8Array(chunks.flatMap((value) => [...value])),
      );
      const data: unknown = JSON.parse(bytes);
      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true ||
        !("data" in data)
      )
        return [];
      const manifest = data.data as {
        plugins?: Record<string, { enabled?: unknown; adminPages?: unknown }>;
      };
      const plugin = manifest?.plugins?.["composer-stacks"];
      if (plugin?.enabled !== true || !Array.isArray(plugin.adminPages))
        return [];
      return plugin.adminPages
        .slice(0, 64)
        .flatMap((page) =>
          page &&
          typeof page === "object" &&
          "path" in page &&
          typeof page.path === "string" &&
          ["/workspaces", "/outcomes", "/maintenance", "/enquiries"].includes(
            page.path,
          )
            ? [page.path]
            : [],
        );
    } catch {
      return [];
    }
  };
  try {
    const available = await pages();
    if (disposed || !nativePath()) {
      dispose();
      return;
    }
    await Promise.all([
      asset("link", "/brand/launcher.css"),
      asset("link", nativeStyles),
    ]);
    if (disposed) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "native-apps-trigger";
    trigger.setAttribute("data-open-apps", "");
    trigger.setAttribute("aria-label", "Open apps");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.title = "Apps and shortcuts (Ctrl/Cmd+K)";
    const image = document.createElement("img");
    image.src = "/brand/composer-icon-20261018-96.png";
    image.alt = "";
    image.width = image.height = 24;
    const label = document.createElement("span");
    label.textContent = "Apps";
    const key = document.createElement("kbd");
    key.textContent = "Ctrl K";
    trigger.append(image, label, key);
    dialog = document.createElement("dialog");
    dialog.id = "app-navigation";
    dialog.dataset.composerHome = "/";
    dialog.setAttribute("data-native-launcher", "");
    dialog.dataset.nativePages = available.join(",");
    dialog.setAttribute("aria-labelledby", "app-navigation-title");
    const heading = document.createElement("div");
    heading.className = "dialog-heading";
    const title = document.createElement("h2");
    title.id = "app-navigation-title";
    title.textContent = "Apps and shortcuts";
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("data-close-apps", "");
    close.textContent = "Close";
    heading.append(title, close);
    const searchLabel = document.createElement("label");
    searchLabel.textContent = "Find an app or task";
    const search = document.createElement("input");
    search.type = "search";
    search.autocomplete = "off";
    searchLabel.append(search);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const list = document.createElement("ul");
    for (const app of apps) {
      const entry = document.createElement("li");
      entry.setAttribute("data-destination", "");
      const link = document.createElement("a");
      link.href = app.href;
      const thumbnail = document.createElement("img");
      thumbnail.src = app.thumbnail;
      thumbnail.width = thumbnail.height = 40;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      const text = document.createElement("span");
      text.textContent = app.name;
      const description = document.createElement("small");
      description.textContent = app.category;
      text.append(description);
      link.append(thumbnail, text);
      entry.append(link);
      list.append(entry);
    }
    dialog.append(heading, searchLabel, status, list);
    container.append(dialog);
    if (!shared.AppComposerLauncher)
      await asset("script", "/brand/launcher.js");
    if (disposed) return;
    fallback.replaceWith(trigger);
    controller =
      shared.AppComposerLauncher?.mount({
        dialog,
        trigger,
        assetBase: new URL("/brand/", location.href),
      }) ?? null;
    if (!controller) throw Error("Native menu controller unavailable.");
    initialKeys.abort();
    if (requestedSearch) controller.open(true);
  } catch {
    // Navigation remains available when an optional menu asset or metadata fails.
    if (!disposed) {
      controller?.dispose();
      if (dialog) shared.AppComposerLauncher?.unmount(dialog);
      initialKeys.abort();
      container.replaceChildren(fallback);
    }
  }
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", () => void install(), {
    once: true,
  });
else void install();
