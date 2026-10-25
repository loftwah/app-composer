import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  catalogueFindings,
  shopifyCatalogueSnapshot,
  type ShopifyCatalogueSnapshot,
} from "../lib/shopify-catalogue-contract";
import { confirmWorkspace } from "./stacks/workspace-scope";
import "./shopify-catalogue-panel.css";
const example: ShopifyCatalogueSnapshot["products"] = [
  {
    id: "gid://shopify/Product/101",
    title: "Riverton trail journal",
    handle: "trail-journal",
    status: "ACTIVE",
    updatedAt: "2026-10-25T00:00:00Z",
    url: "https://fictional-riverton.myshopify.com/products/trail-journal",
    image: { altText: "Orange pocket journal beside a trail map" },
  },
  {
    id: "gid://shopify/Product/102",
    title: "Club launch print",
    handle: "club-launch-print",
    status: "DRAFT",
    updatedAt: "2026-10-25T00:00:00Z",
    url: null,
    image: { altText: null },
  },
];
function ProductReview({
  products,
  fictional = false,
}: {
  products: ShopifyCatalogueSnapshot["products"];
  fictional?: boolean;
}) {
  return (
    <ul className="sc-products">
      {products.map((product) => (
        <li key={product.id}>
          <div>
            <strong>{product.title}</strong>
            <span>{product.status.toLowerCase()}</span>
          </div>
          <ul>
            {catalogueFindings(product).map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
          {product.url && !fictional && (
            <a href={product.url} target="_blank" rel="noreferrer">
              Open product in Shopify's storefront
            </a>
          )}
          {fictional && product.url && (
            <p>
              Example product URL: <code>{product.url}</code>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
export function ShopifyCataloguePanel({ workspace }: { workspace: string }) {
  const [report, setReport] = useState<ShopifyCatalogueSnapshot>();
  const [lastVerified, setLastVerified] = useState<ShopifyCatalogueSnapshot>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0),
    pending = useRef(false);
  async function load(check: boolean) {
    if (pending.current) return;
    pending.current = true;
    const epoch = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/" +
          (check
            ? "shopifyCatalogueCheck"
            : "shopifyCatalogueRead?" +
              new URLSearchParams({ action: "status", workspace })),
        check
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", workspace }),
            }
          : { cache: "no-store" },
      );
      const parsed = shopifyCatalogueSnapshot.parse(
        await parseApiResponse<unknown>(
          response,
          "The selected store could not be checked.",
        ),
      );
      confirmWorkspace(workspace, parsed.workspace.id);
      if (epoch === generation.current) {
        setReport(parsed);
        if (parsed.state === "ready") setLastVerified(parsed);
      }
    } catch {
      if (epoch === generation.current) {
        setReport(undefined);
        setLastVerified(undefined);
        setError(
          "The selected catalogue could not be verified. Check the workspace, store permission and connection before retrying.",
        );
      }
    } finally {
      if (epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    void load(false);
    return () => {
      generation.current++;
      pending.current = false;
    };
  }, [workspace]);
  return (
    <section
      className="shopify-catalogue"
      aria-labelledby="shopify-catalogue-title"
      aria-busy={busy}
    >
      <div className="sc-heading">
        <div>
          <h2 id="shopify-catalogue-title">Prepare a Shopify product launch</h2>
          <p>
            Review product links, publication and image descriptions before
            using them in a Composer campaign.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !report?.shop}
          onClick={() => void load(true)}
        >
          {busy ? "Checking…" : "Check store catalogue"}
        </button>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(false)}
          >
            Retry connection status
          </button>
        </div>
      )}
      {report ? (
        <>
          <p className="sc-scope">
            {report.shop ?? "No selected store"} · {report.environment} · API{" "}
            {report.apiVersion} · <strong>{report.state}</strong>
          </p>
          <p role="status">{report.note}</p>
          {report.observedAt && (
            <p>
              Provider check:{" "}
              <time dateTime={report.observedAt}>
                {new Date(report.observedAt).toLocaleString("en-AU", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
              . Refresh before a launch decision.
            </p>
          )}
          {report.state === "ready" &&
            (report.products.length ? (
              <ProductReview products={report.products} />
            ) : (
              <p>No products were returned by the selected Shopify store.</p>
            ))}
          {report.state !== "ready" && lastVerified && (
            <details>
              <summary>Previous successful observation — not current</summary>
              <p>
                Checked {lastVerified.observedAt}. The latest provider check did
                not pass; review again before using these links.
              </p>
              <ProductReview products={lastVerified.products} />
            </details>
          )}
          {report.atLimit && (
            <p>
              This view covers the twenty most recently updated products. More
              products remain in Shopify.
            </p>
          )}
        </>
      ) : (
        !error && (
          <p role="status">Checking the selected workspace configuration…</p>
        )
      )}
      <details>
        <summary>Try a fictional launch review</summary>
        <p>
          This local example uses two fictional products. No store was
          contacted, no order was created and the example URLs are not live
          destinations.
        </p>
        <ProductReview products={example} fictional />
      </details>
      <p className="sc-footnote">
        Shopify owns the storefront, checkout, orders and fulfilment. This
        companion reads product metadata only.{" "}
        <a href="/prompts#shopify">Prepare the merchant connection</a>
      </p>
    </section>
  );
}
