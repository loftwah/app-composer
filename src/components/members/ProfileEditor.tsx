import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Tags, tagUnsaved, type TagDraft } from "../../plugins/tags-admin";
import {
  Achievements,
  achievementUnsaved,
  type AchievementDraft,
} from "../../plugins/achievements-admin";
import { ShareCard } from "../../plugins/miniapps/share-card";
import {
  ProfileSettings,
  type ProfileFileDraft,
  profileFileUnsaved,
} from "../../plugins/profile-settings-admin";
import type { Profile, Card } from "./profile";
import { downloadJson } from "./api";
import { useFields } from "./use-fields";
import "../../plugins/miniapps-admin.css";

export type ProfileAction = (
  operation: string,
  command?: Record<string, unknown>,
) => Promise<Profile | undefined>;
const fieldNames = {
  title: "Profile name",
  handle: "Public handle",
  intro: "Introduction",
  website: "Website",
  github: "GitHub",
  bluesky: "Bluesky",
  linkedin: "LinkedIn",
  x: "X",
  avatar: "Portrait image URL",
  banner: "Banner image URL",
};

export default function ProfileEditor({
  snapshot,
  busy,
  canPublish,
  canExport,
  act,
  request,
  dirtyChanged,
}: {
  snapshot: Profile;
  busy: boolean;
  canPublish: boolean;
  canExport: boolean;
  act: ProfileAction;
  request: (
    operation: string,
    command?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  dirtyChanged: (dirty: boolean) => void;
}) {
  const identity = useFields(snapshot.draft.config);
  const config = identity.value,
    setConfig = identity.edit;
  const [tag, setTag] = useState<TagDraft>();
  const [achievement, setAchievement] = useState<AchievementDraft>();
  const [file, setFile] = useState<ProfileFileDraft>();
  const [preview, setPreview] = useState(false);
  const [linkDirty, setLinkDirty] = useState<Record<string, boolean>>({});
  const retainedCards = useRef(snapshot.draft.cards);
  const removedCards = retainedCards.current.filter(
    (card) =>
      linkDirty[card.id] &&
      !snapshot.draft.cards.some((current) => current.id === card.id),
  );
  const visibleCards = [...snapshot.draft.cards, ...removedCards];
  retainedCards.current = visibleCards;
  const configDirty = identity.dirty;
  const dirty =
    configDirty ||
    tagUnsaved(tag) ||
    achievementUnsaved(achievement) ||
    profileFileUnsaved(file) ||
    Object.values(linkDirty).some(Boolean);
  // Parent uses this mutable observation only for navigation protection. It is
  // deliberately scoped to this mounted account/workspace/profile instance.
  dirtyChanged(dirty);
  const saveConfig = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (identity.conflicts.length) return;
      const saved = await act("config", config);
      if (saved) setConfig(saved.draft.config);
    })();
  };
  const publicPath = snapshot.publicURL
    ? new URL(snapshot.publicURL).pathname
    : "/showcase/p/" +
      encodeURIComponent(snapshot.draft.config.handle ?? "") +
      "/";
  const commandSave =
    (operation: string) =>
    async (
      fields: Record<string, unknown>,
      failed?: (message: string, code?: string) => void,
    ) => {
      const { operation: action, ...rest } = fields;
      const command =
        operation === "tags" || operation === "achievements"
          ? { action, ...rest }
          : fields;
      try {
        return !!(await request(operation, command));
      } catch (e) {
        failed?.(
          e instanceof Error ? e.message : "The save could not be confirmed.",
          (e as { code?: string })?.code,
        );
        return false;
      }
    };
  const identityField = (key: string, label: string) => (
    <label key={key}>
      {label}
      {key === "intro" ? (
        <textarea
          value={config[key] ?? ""}
          maxLength={240}
          disabled={busy}
          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
        />
      ) : (
        <input
          value={config[key] ?? ""}
          type={
            ["website", "github", "bluesky", "linkedin"].includes(key)
              ? "url"
              : "text"
          }
          required={key === "title" || key === "handle"}
          maxLength={key === "title" ? 80 : key === "handle" ? 40 : 2048}
          disabled={busy}
          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <div className="composer-admin">
      <div className="member-actions">
        <span className="member-state">
          {snapshot.visibility === "published"
            ? snapshot.hasUnpublishedChanges
              ? "Saved changes awaiting publication"
              : "Published profile"
            : snapshot.visibility === "hidden"
              ? "Public profile hidden"
              : "Private draft"}
        </span>
        {snapshot.publicURL && (
          <a
            href={snapshot.publicURL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open public profile
          </a>
        )}
      </div>
      <section>
        <h2>Identity & introduction</h2>
        <p>
          Save a private draft, check its preview, then publish when it is
          ready. Changing your handle does not change who owns the profile.
        </p>
        <form className="member-form" onSubmit={saveConfig}>
          {!!identity.conflicts.length && (
            <div role="alert">
              <p>
                The saved identity changed in fields you were editing. Compare
                your entries above with the saved values below.
              </p>
              <dl>
                {identity.conflicts.map((key) => (
                  <div key={key}>
                    <dt>Saved {key}</dt>
                    <dd>{identity.saved[key]}</dd>
                  </div>
                ))}
              </dl>
              <div className="member-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={identity.useSaved}
                >
                  Use saved identity
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={identity.keepEdits}
                >
                  Keep my identity edits
                </button>
              </div>
            </div>
          )}
          <div className="member-fields">
            {identityField("title", fieldNames.title)}
            {identityField("handle", fieldNames.handle)}
          </div>
          {identityField("intro", fieldNames.intro)}
          <div className="member-actions">
            <button
              type="submit"
              disabled={busy || !configDirty || !!identity.conflicts.length}
            >
              Save profile draft
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Close preview" : "Preview my edits"}
            </button>
            <button
              type="button"
              disabled={busy || !configDirty}
              onClick={identity.useSaved}
            >
              Use saved identity
            </button>
          </div>
          <details
            className="member-optional-identity"
            open={
              Object.keys(config).some(
                (key) =>
                  !["title", "handle", "intro"].includes(key) &&
                  config[key] !== identity.saved[key],
              ) ||
              identity.conflicts.some(
                (key) => !["title", "handle", "intro"].includes(key),
              )
            }
          >
            <summary>Links, images & appearance (optional)</summary>
            <div className="member-form">
              {Object.entries(fieldNames)
                .filter(([key]) => !["title", "handle", "intro"].includes(key))
                .map(([key, label]) => identityField(key, label))}
              <div className="member-fields">
                <label>
                  Profile theme
                  <select
                    disabled={busy}
                    value={config.theme ?? "daylight"}
                    onChange={(e) =>
                      setConfig({ ...config, theme: e.target.value })
                    }
                  >
                    <option value="daylight">Daylight</option>
                    <option value="midnight">Midnight</option>
                  </select>
                </label>
                <label>
                  Layout
                  <select
                    disabled={busy}
                    value={config.layout ?? "profile"}
                    onChange={(e) =>
                      setConfig({ ...config, layout: e.target.value })
                    }
                  >
                    <option value="profile">Profile</option>
                    <option value="grid">Grid</option>
                    <option value="editorial">Editorial</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
              </div>
            </div>
          </details>
        </form>
        {preview && (
          <article
            className="member-preview"
            aria-label="Unsaved profile preview"
          >
            <p className="member-state">Preview · your edits · not published</p>
            <h2>{config.title}</h2>
            <p>@{config.handle}</p>
            <p>{config.intro}</p>
            <ul>
              {snapshot.draft.cards
                .filter((c) => c.status === "published")
                .map((c) => (
                  <li key={c.id}>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </li>
                ))}
            </ul>
          </article>
        )}
      </section>
      <section>
        <h2>Links & groups</h2>
        <p>
          Choose the links, order and featured picks in your saved profile. Link
          visibility and profile publication are separate: publish the profile
          to activate your saved selection.
        </p>
        <LinkForm
          busy={busy}
          save={async (fields) => {
            await request("cards", fields);
            return true;
          }}
          checkSaved={async () => {
            await request("read");
          }}
          dirtyChanged={(value) =>
            setLinkDirty((previous) =>
              previous.new === value ? previous : { ...previous, new: value },
            )
          }
        />
        {visibleCards.length === 0 ? (
          <p>
            Add your first useful link above. It stays in your draft until you
            choose to publish.
          </p>
        ) : (
          <ol className="member-rows">
            {visibleCards.map((item, index) => (
              <li key={item.id}>
                <CardEditor
                  item={item}
                  snapshot={snapshot}
                  busy={busy}
                  index={index}
                  act={act}
                  request={request}
                  removed={
                    !snapshot.draft.cards.some(
                      (current) => current.id === item.id,
                    )
                  }
                  discardRemoved={() =>
                    setLinkDirty((previous) => ({
                      ...previous,
                      [item.id]: false,
                    }))
                  }
                  dirtyChanged={(value) =>
                    setLinkDirty((previous) =>
                      previous[item.id] === value
                        ? previous
                        : { ...previous, [item.id]: value },
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2>Context & milestones</h2>
        <p>
          Use your existing tag and milestone tools to add context. Saved
          changes here enter your private profile draft; publish the profile to
          make them visible.
        </p>
        <Tags
          profileDraft
          collection={snapshot.draft.tags}
          draft={tag}
          change={setTag}
          busy={busy}
          save={commandSave("tags")}
        />
        <Achievements
          profileDraft
          collection={snapshot.draft.achievements}
          draft={achievement}
          change={setAchievement}
          busy={busy}
          save={commandSave("achievements")}
        />
      </section>
      <ShareCard
        config={
          snapshot.draft.config as Record<string, string> & {
            title: string;
            intro: string;
            theme: string;
            layout: string;
          }
        }
        dirty={dirty}
        busy={busy}
        canPublish={canPublish}
        publicPath={publicPath}
        draftOnly
        publishedRevision={snapshot.publishedRevision}
        publicationPending={
          snapshot.hasUnpublishedChanges || snapshot.visibility !== "published"
        }
        request={async (operation, fields) => {
          if (operation === "snapshot") {
            const current = await request("read");
            return {
              ...(current.shareCard as Profile["shareCard"]),
              publicationRevision: current.publishedRevision as number | null,
              unpublished: current.hasUnpublishedChanges as boolean,
            };
          }
          const next = await act("share-card", {
            ...fields,
            action: operation,
          });
          if (!next)
            throw Error(
              "The card selection was not confirmed. Refresh the saved profile before retrying.",
            );
          return next.shareCard;
        }}
      />
      {snapshot.shareCard.stale && (
        <p role="status">
          Your generated card no longer matches the saved profile name, handle
          or introduction. Prepare a fresh card or keep the existing image
          deliberately; it will not be replaced automatically.
        </p>
      )}
      <section>
        <h2>Publish your profile</h2>
        <p>
          {dirty
            ? "You have unsaved edits. Save or discard them before publishing the saved profile."
            : snapshot.hasUnpublishedChanges
              ? "Your saved profile has changes that visitors have not seen yet."
              : "The saved profile is ready to review."}{" "}
          A selected share card needs its asset release before it can be
          activated here.
        </p>
        <div className="member-actions">
          <button
            disabled={
              busy || dirty || !canPublish || !snapshot.draft.config.handle
            }
            onClick={() => void act("publish")}
          >
            Publish saved profile
          </button>
          {snapshot.visibility === "published" && (
            <button
              disabled={busy || !canPublish}
              onClick={() => void act("hide")}
            >
              Hide public profile
            </button>
          )}
        </div>
        {!canPublish && (
          <p>
            Your membership allows editing. Ask the workspace owner for the
            separate Publish action when you are ready.
          </p>
        )}
      </section>
      <ProfileSettings
        profileDraft
        draft={file}
        change={setFile}
        busy={busy}
        exportAllowed={canExport}
        settingsDirty={configDirty}
        request={async (operation, fields) => {
          if (operation === "export") {
            const result = await request("profile-settings", {
              action: "export",
            });
            return result.result;
          }
          const result = await request("profile-settings", {
            action: operation,
            ...fields,
          });
          if (operation === "apply") {
            const next = result.draft as
              { config?: Record<string, string> } | undefined;
            if (next?.config) setConfig(next.config);
          }
          return result.result;
        }}
      />
      {canExport && (
        <details>
          <summary>Export profile configuration</summary>
          <p>
            This export contains saved profile configuration and collection
            references. It is not a complete media backup or a tested
            restoration.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  downloadJson(
                    await request("export"),
                    "linkarooie-profile-configuration.json",
                  );
                } catch {
                  /* The parent retains the actionable request error. */
                }
              })()
            }
          >
            Download configuration
          </button>
        </details>
      )}
    </div>
  );
}

function LinkForm({
  item,
  busy,
  save,
  dirtyChanged,
  removed = false,
  checkSaved,
}: {
  item?: Card;
  busy: boolean;
  save: (fields: Record<string, unknown>) => Promise<boolean>;
  dirtyChanged: (dirty: boolean) => void;
  removed?: boolean;
  checkSaved: () => Promise<void>;
}) {
  const fields = useFields({
    title: item?.title ?? "",
    description: item?.description ?? "",
    url: item?.url ?? "",
  });
  const value = fields.value,
    setValue = fields.edit,
    saved = fields.saved,
    dirty = fields.dirty;
  const [uncertain, setUncertain] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [checking, setChecking] = useState(false);
  const [confirmedRefusal, setConfirmedRefusal] = useState(false);
  useEffect(() => {
    dirtyChanged(dirty || uncertain);
  }, [dirty, uncertain]);
  return (
    <details
      open={dirty || uncertain || !!fields.conflicts.length || removed}
      className="member-link-form"
    >
      <summary>{item ? "Edit link" : "Add a link"}</summary>
      {removed && (
        <div>
          <h3>Your retained link edits</h3>
          <p>{value.title}</p>
          <p>{value.description}</p>
          <p>{value.url}</p>
        </div>
      )}
      <form
        className="member-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (fields.conflicts.length || uncertain) return;
          void (async () => {
            try {
              const success = await save({
                action: item ? "edit" : "create",
                ...(item ? { id: item.id } : {}),
                ...value,
              });
              if (!success) {
                setUncertain(true);
                setSaveError("The link save could not be confirmed.");
                return;
              }
              setUncertain(false);
              setSaveError("");
              if (!item) setValue({ title: "", description: "", url: "" });
              dirtyChanged(false);
            } catch (failure) {
              setUncertain(true);
              setConfirmedRefusal(
                ["CONFLICT", "INVALID", "FORBIDDEN"].includes(
                  String((failure as { code?: string })?.code),
                ),
              );
              setSaveError(
                failure instanceof Error
                  ? failure.message
                  : "The link save could not be confirmed.",
              );
            }
          })();
        }}
      >
        {uncertain && (
          <div role="status">
            <p>
              {saveError} Your entry is retained. Check the saved collection
              before another save.
            </p>
            <button
              type="button"
              disabled={busy || checking}
              onClick={() =>
                void (async () => {
                  setChecking(true);
                  try {
                    await checkSaved();
                    if (item || confirmedRefusal) {
                      setUncertain(false);
                      setSaveError("");
                    } else
                      setSaveError(
                        "The saved list has been refreshed. Compare it with your retained new link, then discard this entry before starting another draft; an absent link cannot prove that an interrupted creation never committed.",
                      );
                  } catch (failure) {
                    setSaveError(
                      failure instanceof Error
                        ? failure.message
                        : "Saved links could not be checked. Your entry is retained.",
                    );
                  } finally {
                    setChecking(false);
                  }
                })()
              }
            >
              Check saved links
            </button>
          </div>
        )}
        {!!fields.conflicts.length && (
          <div role="alert">
            <p>
              This saved link changed while you were editing. Compare the saved
              fields before saving again.
            </p>
            <dl>
              {fields.conflicts.map((key) => (
                <div key={key}>
                  <dt>Saved {key}</dt>
                  <dd>{saved[key as keyof typeof saved]}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                fields.useSaved();
                setUncertain(false);
                dirtyChanged(false);
              }}
            >
              Use saved link
            </button>
            <button type="button" disabled={busy} onClick={fields.keepEdits}>
              Keep my link edits
            </button>
          </div>
        )}
        <label>
          Link title
          <input
            value={value.title}
            required
            maxLength={100}
            disabled={busy}
            onChange={(e) => {
              const next = { ...value, title: e.target.value };
              setValue(next);
              dirtyChanged(JSON.stringify(next) !== JSON.stringify(saved));
            }}
          />
        </label>
        <label>
          Link description
          <textarea
            value={value.description}
            maxLength={240}
            disabled={busy}
            onChange={(e) => {
              const next = { ...value, description: e.target.value };
              setValue(next);
              dirtyChanged(JSON.stringify(next) !== JSON.stringify(saved));
            }}
          />
        </label>
        <label>
          HTTPS destination
          <input
            type="url"
            pattern="https://.*"
            value={value.url}
            required
            maxLength={2048}
            disabled={busy}
            onChange={(e) => {
              const next = { ...value, url: e.target.value };
              setValue(next);
              dirtyChanged(JSON.stringify(next) !== JSON.stringify(saved));
            }}
          />
        </label>
        <div className="member-actions">
          <button
            disabled={busy || !dirty || !!fields.conflicts.length || uncertain}
            type="submit"
          >
            {item ? "Save link draft" : "Add draft link"}
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => {
              fields.useSaved();
              setUncertain(false);
              dirtyChanged(false);
            }}
          >
            Discard link edits
          </button>
        </div>
      </form>
    </details>
  );
}
function CardEditor({
  item,
  snapshot,
  busy: pending,
  index,
  act,
  request,
  dirtyChanged,
  removed = false,
  discardRemoved,
}: {
  item: Card;
  snapshot: Profile;
  busy: boolean;
  index: number;
  act: ProfileAction;
  request: (
    operation: string,
    command?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  dirtyChanged: (dirty: boolean) => void;
  removed?: boolean;
  discardRemoved?: () => void;
}) {
  const busy = pending || removed;
  const initial = snapshot.draft.presentation[item.id] ?? {
    pinned: false,
    icon: "link",
    group: "",
  };
  const styling = useFields({
    pinned: String(initial.pinned),
    icon: initial.icon,
    group: initial.group ?? "",
  });
  const style = {
    pinned: styling.value.pinned === "true",
    icon: styling.value.icon,
    group: styling.value.group,
  };
  const [linkDirty, setLinkDirty] = useState(false);
  const styleDirty = styling.dirty;
  useEffect(() => {
    dirtyChanged(linkDirty || styleDirty);
  }, [linkDirty, styleDirty]);
  const changed = (next: typeof style) => {
    styling.edit({ ...next, pinned: String(next.pinned) });
  };
  return (
    <details
      className="member-card-editor member-saved-link"
      open={linkDirty || styleDirty || removed || !!styling.conflicts.length}
    >
      <summary>
        <span className="member-link-title">
          {item.title || "Linked contribution"}
        </span>
        <span className="member-link-summary">
          {initial.group || "Other links"}
          {initial.pinned ? " · Featured" : ""} ·{" "}
          {item.status === "published"
            ? "Included in next publication"
            : "Excluded from next publication"}
        </span>
      </summary>
      {removed && (
        <div role="status">
          <p>
            This link was removed elsewhere. Your unsaved edits remain below to
            copy. Discard the retained edit when you have checked it.
          </p>
          <button disabled={pending} onClick={discardRemoved}>
            Discard retained removed-link edits
          </button>
        </div>
      )}
      <p className="member-state">
        {item.status} in saved draft
        {item.provider ? " · linked contribution" : ""}
      </p>
      {!item.provider && (
        <LinkForm
          item={item}
          removed={removed}
          busy={busy}
          dirtyChanged={(value) => {
            setLinkDirty(value);
            dirtyChanged(value || styleDirty);
          }}
          save={async (fields) => {
            await request("cards", fields);
            return true;
          }}
          checkSaved={async () => {
            await request("read");
          }}
        />
      )}
      {!!styling.conflicts.length && (
        <div role="alert">
          <p>
            The saved group or featured selection changed. Review the saved
            selection before replacing it.
          </p>
          <p>
            Saved: {initial.group || "Other links"} · {initial.icon} ·{" "}
            {initial.pinned ? "Featured" : "Ordinary link"}
          </p>
          <button disabled={busy} onClick={styling.useSaved}>
            Use saved presentation
          </button>
          <button disabled={busy} onClick={styling.keepEdits}>
            Keep my presentation edits
          </button>
        </div>
      )}
      <div className="member-fields">
        <label>
          Group
          <select
            value={style.group ?? ""}
            disabled={busy}
            onChange={(e) => changed({ ...style, group: e.target.value })}
          >
            <option value="">Other links</option>
            {["Music", "Games", "Projects", "Writing", "Connect"].map(
              (group) => (
                <option key={group}>{group}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Link icon
          <select
            disabled={busy}
            value={style.icon}
            onChange={(e) => changed({ ...style, icon: e.target.value })}
          >
            {[
              "link",
              "book",
              "code",
              "music",
              "video",
              "game",
              "heart",
              "star",
            ].map((icon) => (
              <option key={icon}>{icon}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="member-check">
        <input
          type="checkbox"
          checked={style.pinned}
          disabled={busy}
          onChange={(e) => changed({ ...style, pinned: e.target.checked })}
        />
        Feature this link
      </label>
      <div className="member-actions">
        <button
          disabled={busy || !styleDirty || !!styling.conflicts.length}
          onClick={() =>
            void (async () => {
              if (await act("presentation", { id: item.id, ...style }))
                dirtyChanged(linkDirty);
            })()
          }
        >
          Save group & feature
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void act("cards", {
              action: "visibility",
              id: item.id,
              status: item.status === "published" ? "hidden" : "published",
            })
          }
        >
          {item.status === "published"
            ? "Hide from next publication"
            : "Include in next publication"}
        </button>
        {index > 0 && (
          <button
            disabled={busy}
            onClick={() => {
              const ids = snapshot.draft.cards.map((c) => c.id);
              [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
              void act("cards", { action: "reorder", ids });
            }}
          >
            Move up
          </button>
        )}
        <button
          disabled={busy || linkDirty || styleDirty}
          onClick={() => void act("cards", { action: "delete", id: item.id })}
        >
          Remove saved link
        </button>
      </div>
    </details>
  );
}
