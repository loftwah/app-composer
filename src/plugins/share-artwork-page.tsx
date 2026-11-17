import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { ArtworkCuration } from "../lib/share-gallery";
import "./share-artwork-page.css";

interface ArtworkRow extends Partial<ArtworkCuration> {
  assetId: string;
  title: string;
  project: string;
}

const base = "/_emdash/api/plugins/composer-stacks/";

async function searchArtwork(query: string, signal?: AbortSignal) {
  const response = await apiFetch(
    `${base}shareArtworkRead?${new URLSearchParams({ q: query })}`,
    { cache: "no-store", signal },
  );
  const result = await parseApiResponse<{ items: ArtworkRow[] }>(
    response,
    "The artwork could not be loaded.",
  );
  if (!Array.isArray(result?.items))
    throw Error("The artwork list could not be read. Search again.");
  return result;
}

export function ShareArtworkPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ArtworkRow[]>([]);
  const [selected, setSelected] = useState<ArtworkRow>();
  const [status, setStatus] = useState("Loading curated artwork…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void searchArtwork("", controller.signal)
      .then(({ items }) => {
        if (controller.signal.aborted) return;
        setRows(items);
        setStatus(
          items.length ? "" : "Search the public catalogue to pick artwork.",
        );
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setStatus(error.message);
      });
    return () => controller.abort();
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Searching…");
    try {
      const { items } = await searchArtwork(query.trim());
      setRows(items);
      setSelected(undefined);
      setStatus(items.length ? "" : "No artwork found.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Search failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("Saving…");
    try {
      const response = await apiFetch(base + "shareArtworkWrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selected.assetId,
          featured: data.get("featured") === "on",
          tags: String(data.get("tags") ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const { item } = await parseApiResponse<{ item: ArtworkCuration }>(
        response,
        "Artwork curation could not be saved.",
      );
      setRows((current) =>
        current.map((row) =>
          row.assetId === item.assetId ? { ...row, ...item } : row,
        ),
      );
      setSelected({ ...selected, ...item });
      setStatus(
        item.featured
          ? "Saved. This artwork now appears first in Featured."
          : "Artwork curation saved.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="composer-share-artwork">
      <h1>Share artwork</h1>
      <p>Choose which public artwork leads Share and add tags for browsing.</p>
      <a href="/share">Open public Share</a>
      <form onSubmit={search} className="curation-search">
        <label htmlFor="curation-query">Search public artwork</label>
        <input
          id="curation-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
        />
        <button className="curation-button" disabled={busy}>
          Search
        </button>
      </form>
      <p className="curation-status" role="status">
        {status}
      </p>
      <div className="curation-results">
        <ul aria-label="Artwork results">
          {rows.map((row) => (
            <li key={row.assetId}>
              <button
                className="curation-button"
                type="button"
                disabled={busy}
                aria-pressed={selected?.assetId === row.assetId}
                onClick={() => setSelected(row)}
              >
                <strong>{row.title}</strong>
                <span>
                  {[row.project, row.featured ? "Featured" : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <form
            key={selected.assetId}
            onSubmit={save}
            className="curation-editor"
          >
            <h2>{selected.title}</h2>
            <a
              href={`/share/artwork/${selected.assetId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open artwork
            </a>
            <label className="curation-featured">
              <input
                name="featured"
                type="checkbox"
                defaultChecked={selected.featured ?? false}
              />{" "}
              Featured on Share
            </label>
            <label htmlFor="curation-tags">Tags (comma separated)</label>
            <input
              id="curation-tags"
              name="tags"
              defaultValue={selected.tags?.join(", ") ?? ""}
              maxLength={599}
            />
            <button className="curation-button" disabled={busy}>
              Save curation
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
