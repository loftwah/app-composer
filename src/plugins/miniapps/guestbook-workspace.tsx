import type { Dispatch, SetStateAction, SubmitEvent } from "react";
import { PhotoPreview } from "./photo-preview";
import type { AppAction, Item } from "./types";
interface Props {
  busy: boolean;
  upload: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  showHidden: boolean;
  setShowHidden: Dispatch<SetStateAction<boolean>>;
  setVisible: Dispatch<SetStateAction<number>>;
  contributions: Item[];
  visible: number;
  refresh: number;
  act: AppAction;
}
export function GuestbookWorkspace({
  busy,
  upload,
  showHidden,
  setShowHidden,
  setVisible,
  contributions,
  visible,
  refresh,
  act,
}: Props) {
  return (
    <>
      <details className="ca-disclosure">
        <summary>Add a photo for review</summary>
        <form onSubmit={upload} className="ca-form">
          <label>
            Image
            <input name="image" type="file" accept="image/*" required />
          </label>
          <p className="ca-muted">
            We resize to 1200 pixels and remove metadata. The app independently
            validates a PNG under 1 MB.
          </p>
          <label>
            Image description
            <input name="caption" maxLength={160} required />
          </label>
          <label>
            Name or alias
            <input name="author" maxLength={60} />
          </label>
          <label className="ca-check">
            <input name="consent" type="checkbox" required />I have permission
            to publish this image.
          </label>
          <button disabled={busy} type="submit">
            Submit for review
          </button>
        </form>
      </details>
      <h2>Review contributions</h2>
      <p className="ca-muted">
        Only approved photos can appear publicly or be featured. Hiding a source
        also removes its controlled Showcase view.
      </p>
      <label className="ca-check ca-filter">
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(event) => {
            setShowHidden(event.target.checked);
            setVisible(12);
          }}
        />{" "}
        Include hidden and rejected contributions
      </label>
      {contributions.length === 0 ? (
        <p>No contributions yet. Add a photo to start the collection.</p>
      ) : (
        <div className="ca-contributions">
          {contributions.slice(0, visible).map((item) => (
            <article key={item.id}>
              <PhotoPreview item={item} refresh={refresh} />
              <div>
                <span className="ca-state">{item.status}</span>
                <h3>{item.caption}</h3>
                <p className="ca-muted">{item.author || "No alias supplied"}</p>
                <div className="ca-actions">
                  {item.status !== "approved" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          "guestbook",
                          "moderate",
                          { id: item.id, status: "approved" },
                          "Photo approved. It is now public and eligible for Linkarooie.",
                        )
                      }
                    >
                      Approve photo
                    </button>
                  )}
                  {item.status === "approved" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          "showcase",
                          "feature",
                          { item: item.id },
                          "Photo featured in Linkarooie. Open the live collection to see it.",
                        )
                      }
                    >
                      Feature in Linkarooie
                    </button>
                  )}
                  {item.status !== "hidden" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          "guestbook",
                          "moderate",
                          { id: item.id, status: "hidden" },
                          "Photo hidden. Controlled public and featured paths now refuse it.",
                        )
                      }
                    >
                      Hide photo
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {contributions.length > visible && (
            <button
              disabled={busy}
              onClick={() => setVisible((count) => count + 12)}
            >
              Show more contributions ({contributions.length - visible}{" "}
              remaining)
            </button>
          )}
        </div>
      )}
    </>
  );
}
