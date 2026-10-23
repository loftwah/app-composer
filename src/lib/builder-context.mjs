// A named editorial entry retains one fixed return destination. It never selects
// an owner workspace, grants publication permission or changes a shared URL.
export const WOODHOUSE_BUILDER_RETURN =
  "https://woodhouse.loftwah.com/editions/one-more-round/?report=8496128e32ddfd0bddf8da66#build";

export function isBuilderPath(path) {
  return (
    [
      "/demo",
      "/manage",
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
    /^\/activity\/[a-z-]+$/.test(path)
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
  const url = new URL(destination, source);
  if (
    !hasBuilderContext(source) ||
    url.origin !== source.origin ||
    !isBuilderPath(url.pathname)
  )
    return destination;
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
  if (!hasBuilderContext(source)) return [];
  return [
    ["from", "woodhouse-edition"],
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
