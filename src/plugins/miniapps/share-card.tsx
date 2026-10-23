import { useEffect, useRef, useState } from "react";
import {
  shareCardReceipt,
  type ShareCardSnapshot,
} from "../../lib/miniapp-share-card.mjs";
import type { Snapshot } from "./types";

type RequestCard = (
  operation: "snapshot" | "adopt" | "rollback",
  fields?: Record<string, unknown>,
) => Promise<
  ShareCardSnapshot & {
    publicationRevision?: number | null;
    unpublished?: boolean;
  }
>;
const editor = "https://composer-launch-kit.loftwah.workers.dev/profile.html";
function currentImage(value: string) {
  const url = new URL(value, window.location.origin);
  return url.origin === "https://showcase.loftwah.com"
    ? "/showcase" + url.pathname + url.search
    : value;
}
function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "linkarooie-profile-snapshot.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareCard({
  dirty,
  busy,
  request,
  publicPath = "/showcase/",
  draftOnly = false,
  canPublish = true,
  publishedRevision,
  publicationPending = false,
}: {
  config: Snapshot["config"];
  dirty: boolean;
  busy: boolean;
  request: RequestCard;
  publicPath?: string;
  draftOnly?: boolean;
  canPublish?: boolean;
  publishedRevision?: number | null;
  publicationPending?: boolean;
}) {
  const [saved, setSaved] = useState<ShareCardSnapshot>();
  const [receipt, setReceipt] = useState<ReturnType<typeof shareCardReceipt>>();
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const popup = useRef<Window | null>(null);
  const handoff = useRef<unknown>(null);
  useEffect(() => {
    alive.current = true;
    const receive = (event: MessageEvent) => {
      if (
        event.origin === new URL(editor).origin &&
        event.source === popup.current &&
        event.data?.type === "launch-kit:ready" &&
        handoff.current
      ) {
        popup.current?.postMessage(
          { type: "launch-kit:profile", recipe: handoff.current },
          new URL(editor).origin,
        );
        handoff.current = null;
      }
    };
    window.addEventListener("message", receive);
    return () => {
      alive.current = false;
      generation.current++;
      handoff.current = null;
      window.removeEventListener("message", receive);
    };
  }, []);
  const eligible =
    !!receipt &&
    !!saved &&
    decoded &&
    !dirty &&
    receipt.profile.id === saved.profile.id &&
    receipt.profile.revision === saved.profile.revision;
  const refresh = async () => {
    const version = ++generation.current;
    try {
      const snapshot = await request("snapshot");
      if (alive.current && version === generation.current) {
        setSaved(snapshot);
        setStatus(
          draftOnly
            ? "Current saved image loaded. Your unsaved settings are retained."
            : "Current published image loaded. Your unsaved settings are retained.",
        );
      }
      return alive.current && version === generation.current
        ? snapshot
        : undefined;
    } catch (error) {
      if (version === generation.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "The profile is unavailable. Your edits are retained.",
        );
    }
  };
  const seed = async (openEditor = false) => {
    const target = new URL(editor);
    target.searchParams.set("ownerOrigin", window.location.origin);
    target.searchParams.set(
      "return",
      window.location.origin + window.location.pathname,
    );
    // A same-origin blank window retains the opening gesture while the saved
    // snapshot is checked. Its origin/source is verified for the later handoff.
    const opened = openEditor ? window.open("about:blank", "_blank") : null;
    if (opened) popup.current = opened;
    const current = await refresh();
    if (!current) {
      opened?.close();
      return;
    }
    const recipe = {
      format: "linkarooie.profile-snapshot",
      version: 1,
      profile: { id: current.profile.id, revision: current.profile.revision },
      text: {
        name: current.profile.name,
        handle: current.profile.handle,
        description: current.profile.description,
        alt: `${current.profile.name}${current.profile.handle ? " · @" + current.profile.handle : ""} — profile card`,
      },
    };
    if (opened) {
      handoff.current = recipe;
      opened.location.href = target.href;
      setStatus(
        "Saved profile sent to the local card editor. Your unsaved edits remain here. Download a snapshot if the browser prevents the hand-off.",
      );
      return;
    }
    download(recipe);
    setStatus(
      "Profile snapshot export requested. Check your downloads, then open the card editor and import it. No artwork was copied. This page keeps your edits.",
    );
  };
  const choose = async (file: File | undefined) => {
    const version = ++generation.current;
    setReceipt(undefined);
    setSelected(false);
    setDecoded(false);
    if (!file) {
      setStatus("Selection cancelled. The published image is unchanged.");
      return;
    }
    try {
      if (file.size > 32768)
        throw Error("Choose an adoption receipt under 32 KiB.");
      const parsed = shareCardReceipt(JSON.parse(await file.text()));
      const snapshot = await request("snapshot");
      if (version !== generation.current) return;
      setSaved(snapshot);
      if (
        parsed.profile.id !== snapshot.profile.id ||
        parsed.profile.revision !== snapshot.profile.revision
      )
        throw Error(
          "This card belongs to another profile or an older revision. Prepare a new card using a fresh snapshot.",
        );
      setReceipt(parsed);
      setStatus(
        "Proposed replacement loaded. Inspect the deployed asset beside the current image, then select it.",
      );
    } catch (error) {
      if (version === generation.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "This receipt could not be read. Choose it again.",
        );
    }
  };
  const publish = async (operation: "adopt" | "rollback") => {
    if (
      !canPublish ||
      !saved ||
      dirty ||
      (operation === "adopt" && (!selected || !eligible))
    )
      return;
    const version = ++generation.current;
    try {
      const result = await request(operation, {
        expectedRevision: saved.profile.revision,
        ...(operation === "adopt" ? { receipt } : {}),
      });
      if (version !== generation.current) return;
      setSaved(result);
      setReceipt(undefined);
      setSelected(false);
      setStatus(
        draftOnly
          ? "Image selected in your saved draft. Publish your profile to activate it for visitors, then verify the public result."
          : operation === "adopt"
            ? "Published. Verify the served page and image next."
            : "Previous approved image restored and published. Verify the served result next.",
      );
    } catch (error) {
      if (version === generation.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Publication was not confirmed. Check the current image before retrying.",
        );
    }
  };
  const verify = async () => {
    if (!saved?.approved || publicationPending) return;
    const version = ++generation.current;
    try {
      const response = await fetch(publicPath, {
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) throw Error("The public profile is unavailable.");
      const html = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const image = html
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content");
      const canonical = html
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href");
      const expected = new URL(
        "/showcase" + saved.approved.path,
        window.location.origin,
      ).href;
      if (
        image !== expected ||
        html
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") !== saved.profile.name ||
        html
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content") !== saved.profile.description ||
        (draftOnly &&
          (!publishedRevision ||
            html
              .querySelector('meta[name="linkarooie:profile-revision"]')
              ?.getAttribute("content") !== String(publishedRevision))) ||
        html
          .querySelector('meta[property="og:image:alt"]')
          ?.getAttribute("content") !== saved.approved.alt ||
        canonical !== new URL(publicPath, window.location.origin).href ||
        html
          .querySelector('meta[property="og:image:type"]')
          ?.getAttribute("content") !== "image/png" ||
        html
          .querySelector('meta[property="og:image:width"]')
          ?.getAttribute("content") !== "1200" ||
        html
          .querySelector('meta[property="og:image:height"]')
          ?.getAttribute("content") !== "630"
      )
        throw Error(
          "The served metadata differs from the selected card. Refresh before retrying.",
        );
      const asset = await fetch(expected, {
        cache: "no-store",
        redirect: "error",
      });
      if (
        !asset.ok ||
        asset.headers.get("content-type")?.split(";")[0] !== "image/png"
      )
        throw Error(
          "The public image is unavailable or has an incorrect type.",
        );
      const blob = await asset.blob();
      if (blob.size > 5 * 1024 ** 2)
        throw Error("The served image exceeds 5 MiB.");
      const bytes = await blob.arrayBuffer();
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      const bitmap = await createImageBitmap(blob);
      const dimensions = bitmap.width === 1200 && bitmap.height === 630;
      bitmap.close();
      if (hash !== saved.approved.sha256 || !dimensions)
        throw Error(
          "The served image differs from the approved encoded output.",
        );
      const current = await request("snapshot");
      if (
        current.profile.revision !== saved.profile.revision ||
        (draftOnly &&
          (current.publicationRevision !== publishedRevision ||
            current.unpublished))
      )
        throw Error(
          "The profile changed during verification. Refresh and verify its current image.",
        );
      if (version === generation.current)
        setStatus(
          "Served result verified: mounted profile URL, PNG type, 1200 × 630 dimensions, exact image hash and current profile revision agree. Native social unfurls remain separate.",
        );
    } catch (error) {
      if (version === generation.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Served verification failed. The published image is retained.",
        );
    }
  };
  return (
    <section className="ca-share-card" aria-labelledby="profile-card-heading">
      <h2 id="profile-card-heading">Profile shared-link image</h2>
      <p>
        Make a card with your exact name and bio, local artwork or type alone.
        Open the editor in a separate tab to keep your work here.
      </p>
      <div className="ca-actions">
        <button type="button" disabled={busy} onClick={() => void seed(true)}>
          Prepare share card
        </button>
        <button type="button" disabled={busy} onClick={() => void seed()}>
          Download profile snapshot
        </button>
        <a href={editor} target="_blank" rel="noopener noreferrer">
          Open card editor ↗
        </a>
      </div>
      {dirty && (
        <p className="ca-muted">
          The card uses your saved profile. Your unsaved edits stay here; save
          them before preparing a card that includes those changes.
        </p>
      )}
      <details>
        <summary>
          {draftOnly
            ? "Select a prepared card"
            : "Apply and publish a prepared card"}
        </summary>
        <p>
          The editor renders locally. Download its PNG and recipe, then ask your
          agent to prepare the immutable asset in Linkarooie’s repository and
          deploy it through the existing release route. Return with the adoption
          receipt to{" "}
          {draftOnly
            ? "select it in your saved draft. Publish your profile separately to activate it for visitors."
            : "publish it here."}
        </p>
        <p>
          <a
            href="/launch-kit#profile-publication"
            target="_blank"
            rel="noopener noreferrer"
          >
            Commands and publication guide ↗
          </a>
        </p>
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Load current image
        </button>
        <label>
          Prepared adoption receipt
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              void choose(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {saved && (
          <div className="ca-share-comparison">
            <figure>
              <figcaption>
                {draftOnly ? "Current saved image" : "Current published image"}
              </figcaption>
              <img
                src={currentImage(saved.profile.shareImage)}
                alt="Current profile shared-link image"
                width="1200"
                height="630"
              />
              <a
                href={saved.profile.shareImage}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open current image ↗
              </a>
            </figure>
            {receipt && (
              <figure>
                <figcaption>Proposed replacement</figcaption>
                <img
                  src={"/showcase" + receipt.image.path}
                  alt={receipt.image.alt}
                  width="1200"
                  height="630"
                  key={receipt.image.sha256}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    if (
                      image.naturalWidth === 1200 &&
                      image.naturalHeight === 630
                    )
                      setDecoded(true);
                    else {
                      setDecoded(false);
                      setStatus(
                        "The proposed image has incorrect dimensions. Ask your agent to prepare the PNG again.",
                      );
                    }
                  }}
                  onError={() => {
                    setDecoded(false);
                    setSelected(false);
                    setStatus(
                      "The proposed asset is not served yet. Have your agent deploy it, then choose the receipt again. The current image is retained.",
                    );
                  }}
                />
              </figure>
            )}
          </div>
        )}
        {receipt && (
          <>
            <p>
              This replaces the current shared-link image only. Your portrait,
              banner, links and settings stay yours.
            </p>
            <label className="ca-share-select">
              <input
                type="checkbox"
                checked={selected}
                disabled={busy || !canPublish || !eligible}
                onChange={(event) => setSelected(event.target.checked)}
              />
              I inspected this replacement and want to use it publicly.
            </label>
            <button
              type="button"
              disabled={busy || !canPublish || !eligible || !selected}
              onClick={() => void publish("adopt")}
            >
              {draftOnly
                ? "Select image for next publication"
                : "Publish selected image"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                generation.current++;
                setReceipt(undefined);
                setSelected(false);
                setStatus(
                  "Selection cancelled. The published image is unchanged.",
                );
              }}
            >
              Keep current image
            </button>
          </>
        )}
        {saved?.previous && (
          <button
            type="button"
            disabled={busy || dirty || !canPublish}
            onClick={() => void publish("rollback")}
          >
            Restore previous approved image
          </button>
        )}
        {saved?.approved && (
          <button
            type="button"
            disabled={busy || publicationPending}
            onClick={() => void verify()}
          >
            Verify served result
          </button>
        )}
      </details>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
