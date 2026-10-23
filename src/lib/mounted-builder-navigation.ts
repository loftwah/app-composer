import {
  builderHref,
  builderParameters,
  builderReturnHref,
  hasBuilderContext,
} from "./builder-context.mjs";

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
  const rewriter = new HTMLRewriter().on("a[href]", {
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
  return rewriter.transform(response);
}
