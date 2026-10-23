// A labelled HTTP double for boundary tests, not real public deployment proof.
export function platformPublicFixture(f) {
  return async (req) => {
    const path = new URL(req.url).pathname;
    const stack = path.startsWith("/s/")
      ? f.sqlite
          .prepare("SELECT * FROM creator_stacks WHERE slug=?")
          .get(path.split("/")[2])
      : f.sqlite
          .prepare(
            "SELECT s.* FROM creator_stacks s JOIN creator_stack_resource_bindings b ON b.stack_id=s.id WHERE b.resource_id=?",
          )
          .get(path.split("/")[3]);
    if (!stack) return new Response(null, { status: 404 });
    const escape = (s) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    let body;
    if (path.startsWith("/s/")) {
      const resource = JSON.parse(stack.published_json).instances[0].resource;
      body = `<title>${escape(stack.name)} · App Composer</title><a href="${resource.path}">Open</a><div data-outcome-publication="${stack.published_revision}"></div>`;
    } else
      body = `<html data-app="guestbook"><link rel="canonical" href="https://composer.loftwah.com${path}"><h1>${escape(stack.name)}</h1></html>`;
    return new Response(body, { headers: { "Content-Type": "text/html" } });
  };
}
