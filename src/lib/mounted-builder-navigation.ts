import {
  builderHref,
  builderParameters,
  builderReturnHref,
  hasBuilderContext,
} from "./builder-context.mjs";
import type {
  HTMLRewriter as WorkerHTMLRewriter,
  Response as WorkerResponse,
} from "@cloudflare/workers-types";

// Composer owns its mounted adapter; the independent app retains its own HTML,
// canonical metadata, records and release. Decorate reader navigation only.
export function mountedBuilderNavigation(request: Request, response: Response) {
  const source = new URL(request.url);
  if (
    request.method !== "GET" ||
    !source.pathname.startsWith("/guestbook/") ||
    !response.headers.get("Content-Type")?.startsWith("text/html") ||
    !builderParameters(source).length
  )
    return response;
  const Rewriter = (
    globalThis as unknown as { HTMLRewriter: typeof WorkerHTMLRewriter }
  ).HTMLRewriter;
  const rewriter = new Rewriter().on("a[href]", {
    element(element) {
      if (element.hasAttribute("download")) return;
      const href = element.getAttribute("href");
      if (href) element.setAttribute("href", builderHref(source, href));
    },
  });
  if (hasBuilderContext(source))
    rewriter.on("main", {
      element(element) {
        // Fixed public destination; no request-selected return or private scope.
        const href = builderReturnHref(source).replaceAll("&", "&amp;");
        element.prepend(
          `<p class="small"><a href="${href}">Return to One more round</a></p>`,
          { html: true },
        );
      },
    });
  return rewriter.transform(
    response as unknown as WorkerResponse,
  ) as unknown as Response;
}
