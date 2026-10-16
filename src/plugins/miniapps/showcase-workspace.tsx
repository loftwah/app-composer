import type { Dispatch, SetStateAction, SubmitEvent } from "react";
import { appSettings } from "../../lib/app-settings.mjs";
import { Achievements, type AchievementDraft } from "../achievements-admin";
import { Tags, type TagDraft } from "../tags-admin";
import { LinkEditor, LinkStyle } from "./link-editor";
import type { AppAction, Snapshot, Item, LinkDraft, StyleDraft } from "./types";
interface Props {
  busy: boolean;
  addLink: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  snapshot: Snapshot;
  achievementDraft: AchievementDraft | undefined;
  setAchievementDraft: Dispatch<SetStateAction<AchievementDraft | undefined>>;
  tagDraft: TagDraft | undefined;
  setTagDraft: Dispatch<SetStateAction<TagDraft | undefined>>;
  linkDrafts: Record<string, LinkDraft>;
  linkEdit: (id: string, value?: LinkDraft) => void;
  styleDrafts: Record<string, StyleDraft>;
  styleEdit: (id: string, value?: StyleDraft) => void;
  act: AppAction;
  errors: Partial<Record<"guestbook" | "showcase", string>>;
  approved: Item[];
}
export function ShowcaseWorkspace({
  busy,
  addLink,
  snapshot,
  achievementDraft,
  setAchievementDraft,
  tagDraft,
  setTagDraft,
  linkDrafts,
  linkEdit,
  styleDrafts,
  styleEdit,
  act,
  errors,
  approved,
}: Props) {
  return (
    <>
      <details className="ca-disclosure">
        <summary>Add a link</summary>
        <form onSubmit={addLink} className="ca-form">
          <label>
            Title
            <input name="title" maxLength={100} required />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={240} />
          </label>
          <label>
            HTTPS destination
            <input name="url" type="url" pattern="https://.*" required />
          </label>
          <button disabled={busy} type="submit">
            Save draft link
          </button>
        </form>
      </details>
      {appSettings.showcase.achievementCollection?.version === 1 && (
        <Achievements
          collection={snapshot.achievementCollection ?? null}
          draft={achievementDraft}
          change={setAchievementDraft}
          busy={busy}
          save={(fields, failed) =>
            act("showcase", "achievement", fields, "Achievement saved.", failed)
          }
        />
      )}
      {appSettings.showcase.tagCollection?.version === 1 && (
        <Tags
          collection={snapshot.tagCollection ?? null}
          draft={tagDraft}
          change={setTagDraft}
          busy={busy}
          save={(fields, failed) =>
            act("showcase", "tag", fields, "Tag saved.", failed)
          }
        />
      )}
      <h2>Your collection</h2>
      <p className="ca-muted">
        Up to {appSettings.showcase.cardCollection?.limit ?? 8} cards
        {appSettings.showcase.cardCollection
          ? ", with eight featured picks and grouped discovery"
          : ""}
        . Photo visibility remains controlled by Guestbook.
      </p>
      {snapshot.items.length === 0 ? (
        <p>No cards yet. Add a link or feature an approved contribution.</p>
      ) : (
        snapshot.items.map((item, index) => (
          <article className="ca-card-row" key={item.id}>
            <div>
              <span className="ca-state">{item.status}</span>
              <h3>{item.title}</h3>
              <p className="ca-muted">
                {item.provider ? "Connected Guestbook photo" : item.url}
              </p>
              {!item.provider && (
                <LinkEditor
                  item={item}
                  edit={linkDrafts[item.id]}
                  onEdit={(draft) => linkEdit(item.id, draft)}
                  busy={busy}
                  save={(fields, failed) =>
                    act("showcase", "edit-link", fields, "Link saved.", failed)
                  }
                />
              )}
              <LinkStyle
                item={item}
                edit={styleDrafts[item.id]}
                onEdit={(draft) =>
                  styleEdit(
                    item.id,
                    draft ? { ...draft, title: item.title } : undefined,
                  )
                }
                busy={busy}
                save={(fields, failed) =>
                  act(
                    "showcase",
                    "presentation",
                    fields,
                    "Link style saved. Content and visibility are unchanged.",
                    failed,
                  )
                }
              />
            </div>
            <div className="ca-actions">
              {item.status !== "published" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "showcase",
                      "card",
                      { id: item.id, status: "published" },
                      "Card published. Open Linkarooie to see the current collection.",
                    )
                  }
                >
                  Publish card
                </button>
              )}
              {item.status === "published" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "showcase",
                      "card",
                      { id: item.id, status: "hidden" },
                      "Card hidden from the public collection.",
                    )
                  }
                >
                  Hide card
                </button>
              )}
              {index > 0 && (
                <button
                  disabled={busy}
                  aria-label={"Move " + item.title + " up"}
                  onClick={() => {
                    const order = snapshot.items.map((card) => card.id);
                    [order[index - 1], order[index]] = [
                      order[index],
                      order[index - 1],
                    ];
                    void act(
                      "showcase",
                      "reorder",
                      { ids: order },
                      "Card order saved.",
                    );
                  }}
                >
                  Move up
                </button>
              )}
            </div>
          </article>
        ))
      )}
      {Object.entries(linkDrafts)
        .filter(([id]) => !snapshot.items.some((item) => item.id === id))
        .map(([id, draft]) => (
          <LinkEditor
            key={id}
            item={{ id, ...draft.from }}
            edit={draft}
            onEdit={(value) => linkEdit(id, value)}
            removed
            busy={busy}
            save={async () => false}
          />
        ))}
      {Object.entries(styleDrafts)
        .filter(([id]) => !snapshot.items.some((item) => item.id === id))
        .map(([id, draft]) => (
          <section className="ca-disclosure" key={id}>
            <h3>
              Retained style edit
              {draft.title ? " · " + draft.title : ""}
            </h3>
            <p>
              This card was removed. The unsaved style was {draft.value.icon}
              {draft.value.pinned
                ? ", pinned before other cards"
                : ", without pinning"}
              .
            </p>
            <button type="button" disabled={busy} onClick={() => styleEdit(id)}>
              Discard style edit
            </button>
          </section>
        ))}
      <details className="ca-disclosure">
        <summary>Feature an approved photo ({approved.length})</summary>
        {errors.guestbook ? (
          <p>{errors.guestbook}</p>
        ) : (
          approved.map((item) => (
            <div className="ca-card-row" key={item.id}>
              <p>{item.caption}</p>
              <button
                disabled={busy}
                onClick={() =>
                  void act(
                    "showcase",
                    "feature",
                    { item: item.id },
                    "Approved photo featured.",
                  )
                }
              >
                Feature photo
              </button>
            </div>
          ))
        )}
      </details>
    </>
  );
}
