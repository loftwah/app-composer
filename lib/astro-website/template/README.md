# Composer static Astro website

A small, independently owned website built with [Astro](https://astro.build) and
Markdown. It is the local scaffold for Composer issue #971: a static starter you
can preview, put in your own Git repository and publish as static assets. It is
**fictional demo content** — replace it with your own words before publishing.

What is here:

- a home page, an about page, a posts index, individual post pages and a real 404;
- native Astro content collections with a schema-validated Markdown collection;
- accessible navigation, skip link, semantic landmarks and readable typography;
- **no CMS, database, adapter, GitHub or Cloudflare integration** — the static
  output in `dist/` can be served by Workers Static Assets or any static host.

## Spec

The generated site comes from one plain-data spec:

```json
{
  "schema": "app-composer/astro-website/v1",
  "title": "Quiet Harbor",
  "description": "Notes on small tools, careful writing, and the web made by hand.",
  "about": "A short paragraph about this site.",
  "firstPost": {
    "title": "A smaller way to publish",
    "description": "Why a plain Markdown file is a durable place to start.",
    "date": "2026-11-19",
    "body": "The starting text of the first post."
  }
}
```

Every value is a plain string and `date` is `YYYY-MM-DD`. Generation writes
`title`, `description` and `about` into `src/site.json`, and writes the first
post's `title`, `description`, `date` and `body` into
`src/content/posts/first-post.md` with `draft: false`. The spec is data, never
executable instructions.

## Run locally

Use Node 26.13.1 and pnpm 12.19.0. `pnpm-lock.yaml` pins the dependencies so installs are reproducible.

```sh
pnpm install --frozen-lockfile
pnpm dev      # local preview at http://localhost:4321
pnpm build    # static site in dist/ (also validates post frontmatter)
pnpm preview  # serve the built site
```

## Edit the site

- Change `title`, `description` and `about` in `src/site.json`.
- Add a Markdown file to `src/content/posts/`. The file name is the canonical
  route, so `hello.md` is served at `/posts/hello/`.
- Each post needs a `title`, `description` and `date` (`YYYY-MM-DD`). `draft` is
  optional and defaults to `false`.
- Set `draft: true` to keep a post out of the index, the routes and the built
  output while you work on it. There is no draft-preview route: `noindex` is not
  access control.

A missing field or an invalid date fails `pnpm build` with an error naming the
content file. Two files that would produce the same route also fail the build.

## Publishing

This is static output only. No adapter is configured because no on-demand
rendering is used; add one only if you later choose a feature that needs it.
Point a static host (for example Cloudflare Workers Static Assets) at `dist/`.
Add a `site` value to `astro.config.mjs` when the real hostname is known to emit
canonical URLs. Deployment, branch previews, domains and recovery are separate
choices handled by Composer, not by this scaffold.
