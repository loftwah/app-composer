// Only verification exclusions travel to the independently owned editor.
// Project, drawing, account and arbitrary destination fields stay out of URLs.
export function ldrawDestination(input) {
  const incoming = input instanceof URL ? input : new URL(input);
  const target = new URL("https://ldraw.loftwah.com/");
  if (incoming.searchParams.get("analytics") === "off")
    target.searchParams.set("analytics", "off");
  const qa = incoming.searchParams.get("qa");
  if (qa && /^[a-zA-Z0-9_-]{1,64}$/.test(qa)) target.searchParams.set("qa", qa);
  return target;
}
