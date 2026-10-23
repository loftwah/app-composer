// A named editorial entry retains one fixed return destination. It never selects
// an owner workspace, grants publication permission or changes a shared URL.
export const WOODHOUSE_BUILDER_RETURN =
  "https://woodhouse.loftwah.com/editions/one-more-round/?report=8496128e32ddfd0bddf8da66#build";

export function isBuilderPath(path) {
  return (
    [
      "/",
      "/apps",
      "/docs",
      "/architecture",
      "/guide",
      "/explore",
      "/review",
      "/catalogue",
      "/release",
      "/privacy",
      "/extension",
      "/php2shell",
      "/ready/guide",
      "/demo",
      "/manage",
      "/studio", // Public explanation; the /_emdash editor remains excluded.
      "/activity",
      "/init",
      "/init/content",
      "/init/launch-kit",
      "/ready",
      "/learn",
      "/building",
      "/launch-kit",
      "/launch-kit/example/",
    ].includes(path) ||
    /^\/reports\/(?:new|r[a-f0-9]{24})$/.test(path) ||
    /^\/activity\/[a-z-]+$/.test(path) ||
    /^\/s\/[a-z0-9-]{1,60}$/.test(path) ||
    /^\/(?:guestbook|showcase)\/?$/.test(path) ||
    /^\/guestbook\/(?:contribute|item\/[a-z0-9-]{6,64})$/.test(path) ||
    /^\/catalogue\/[a-z0-9-]+$/.test(path) ||
    /^\/guestbook\/r\/[a-z0-9-]{6,64}\/c\/[1-9][0-9]*\/(?:contribute|item\/[a-z0-9-]{6,64})?$/.test(
      path,
    )
  );
}

export function hasBuilderContext(url) {
  return (
    isBuilderPath(url.pathname) &&
    url.searchParams.getAll("from").length === 1 &&
    url.searchParams.get("from") === "woodhouse-edition"
  );
}

export function builderHref(source, destination) {
  if (destination.startsWith("#")) return destination;
  if (!builderParameters(source).length) return destination;
  const url = new URL(destination, source);
  if (
    !isBuilderPath(source.pathname) ||
    url.origin !== source.origin ||
    !isBuilderPath(url.pathname)
  )
    return destination;
  if (hasBuilderContext(source))
    url.searchParams.set("from", "woodhouse-edition");
  // Verification controls stay explicit; no other incoming query becomes state.
  for (const [key, value] of [
    ["analytics", "off"],
    ["qa", "1"],
  ]) {
    if (
      source.searchParams.getAll(key).length === 1 &&
      source.searchParams.get(key) === value
    )
      url.searchParams.set(key, value);
  }
  return url.pathname + url.search + url.hash;
}

export function builderParameters(source) {
  if (!isBuilderPath(source.pathname)) return [];
  return [
    ...(hasBuilderContext(source) ? [["from", "woodhouse-edition"]] : []),
    ...[
      ["analytics", "off"],
      ["qa", "1"],
    ].filter(
      ([key, value]) =>
        source.searchParams.getAll(key).length === 1 &&
        source.searchParams.get(key) === value,
    ),
  ];
}

export function builderReturnHref(source) {
  const url = new URL(WOODHOUSE_BUILDER_RETURN);
  for (const [key, value] of builderParameters(source))
    if (key !== "from") url.searchParams.set(key, value);
  return url.href;
}

// A native launcher can create links after server rendering. Repair a known
// reader navigation at ingress too, before optional collection or page work.
export function builderNavigationRedirect(request) {
  if (request.method !== "GET") return null;
  let referrer;
  try {
    referrer = new URL(request.headers.get("Referer") ?? "");
  } catch {
    return null;
  }
  const current = new URL(request.url);
  if (referrer.origin !== current.origin) return null;
  const destination = builderHref(referrer, current.href);
  const next = new URL(destination, current);
  if (next.href === current.href) return null;
  return new Response(null, {
    status: 302,
    headers: { Location: next.href, "Cache-Control": "no-store" },
  });
}
