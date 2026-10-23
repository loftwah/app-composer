import { ProfileSettings } from "./profile-settings-admin";
import type { PluginAdminExports } from "emdash";
import { appSettings } from "../lib/app-settings.mjs";
import { Settings } from "./miniapps/settings";
import { GuestbookWorkspace } from "./miniapps/guestbook-workspace";
import { ShowcaseWorkspace } from "./miniapps/showcase-workspace";
import { useMiniapps } from "./miniapps/use-miniapps";
import { CollectionSources } from "./miniapps/collection-sources";
import { ShareCard } from "./miniapps/share-card";
import type { AppID } from "./miniapps/types";
import "./miniapps-admin.css";
const names = { guestbook: "Here / there", showcase: "Linkarooie" };
function AppPage() {
  const {
    achievementDraft,
    setAchievementDraft,
    tagDraft,
    setTagDraft,
    profileFileDraft,
    setProfileFileDraft,
    linkDrafts,
    linkEdit,
    styleDrafts,
    styleEdit,
    selected,
    setSelected,
    visible,
    setVisible,
    showHidden,
    setShowHidden,
    errors,
    busy,
    message,
    setMessage,
    drafts,
    setDrafts,
    generation,
    reload,
    act,
    profileRequest,
    collectionRequest,
    shareCardRequest,
    upload,
    addLink,
    newLink,
    changeNewLink,
    snapshot,
    contributions,
    approved,
  } = useMiniapps();
  return (
    <section className="composer-admin">
      <div className="ca-heading">
        <div>
          <h1>Manage your mini-apps</h1>
          <p>
            Review a contribution, feature it in your collection, then open the
            result.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void reload()}>
          Refresh apps
        </button>
      </div>
      <nav className="ca-switcher" aria-label="Choose a connected mini-app">
        {(["guestbook", "showcase"] as AppID[]).map((app) => (
          <button
            key={app}
            type="button"
            disabled={busy}
            aria-pressed={selected === app}
            onClick={() => {
              setSelected(app);
              setMessage("");
            }}
          >
            {names[app]}{" "}
            <span>
              {app === "guestbook" ? "Photo guestbook" : "Curated collection"}
            </span>
          </button>
        ))}
      </nav>
      <p role="status" aria-live="polite" className="ca-message">
        {message}
      </p>
      <CollectionSources
        active={selected === "showcase"}
        busy={busy}
        request={collectionRequest}
      />
      {errors[selected] ? (
        <div role="alert">
          <p>{errors[selected]}</p>
          <button type="button" onClick={() => void reload()}>
            Check connection again
          </button>
        </div>
      ) : !snapshot ? (
        <p role="status">Loading the app’s current records…</p>
      ) : (
        <>
          <div className="ca-app-heading">
            <div>
              <h2>{snapshot.config.title}</h2>
              <p className="ca-muted">
                {selected === "guestbook"
                  ? "Own database + private photo bucket"
                  : "Own database + approved Guestbook items"}{" "}
                · source pinned to the reviewed release
              </p>
            </div>
            <div className="ca-links">
              <a
                href={"/" + selected + "/"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open live app ↗
              </a>
              <a
                href={"https://" + selected + ".loftwah.com"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Standalone ↗
              </a>
            </div>
          </div>
          <div className="ca-workspace">
            <div className="ca-main">
              {selected === "guestbook" ? (
                <GuestbookWorkspace
                  busy={busy}
                  upload={upload}
                  showHidden={showHidden}
                  setShowHidden={setShowHidden}
                  setVisible={setVisible}
                  contributions={contributions}
                  visible={visible}
                  refresh={generation.current}
                  act={act}
                />
              ) : (
                <ShowcaseWorkspace
                  busy={busy}
                  addLink={addLink}
                  newLink={newLink}
                  changeNewLink={changeNewLink}
                  snapshot={snapshot}
                  achievementDraft={achievementDraft}
                  setAchievementDraft={setAchievementDraft}
                  tagDraft={tagDraft}
                  setTagDraft={setTagDraft}
                  linkDrafts={linkDrafts}
                  linkEdit={linkEdit}
                  styleDrafts={styleDrafts}
                  styleEdit={styleEdit}
                  act={act}
                  errors={errors}
                  approved={approved}
                />
              )}
            </div>
            <aside>
              {drafts[selected] && (
                <p className="ca-muted">Unsaved app settings</p>
              )}
              <Settings
                key={selected}
                app={selected}
                config={drafts[selected] ?? snapshot.config}
                change={(value) =>
                  setDrafts((previous) => ({ ...previous, [selected]: value }))
                }
                busy={busy}
                save={async (fields, failed) => {
                  const saved = await act(
                    selected,
                    "settings",
                    fields,
                    "App settings saved. Open the live app to see the result.",
                    failed,
                  );
                  if (saved)
                    setDrafts((previous) => {
                      const next = { ...previous };
                      delete next[selected];
                      return next;
                    });
                  return saved;
                }}
              />
              {selected === "showcase" && (
                <ShareCard
                  config={drafts.showcase ?? snapshot.config}
                  dirty={
                    !!drafts.showcase &&
                    JSON.stringify(drafts.showcase) !==
                      JSON.stringify(snapshot.config)
                  }
                  busy={busy}
                  request={shareCardRequest}
                />
              )}
              {selected === "showcase" &&
                appSettings.showcase.profileSettings?.version === 1 && (
                  <ProfileSettings
                    draft={profileFileDraft}
                    change={setProfileFileDraft}
                    busy={busy}
                    settingsDirty={
                      !!drafts.showcase &&
                      JSON.stringify(drafts.showcase) !==
                        JSON.stringify(snapshot.config)
                    }
                    request={profileRequest}
                  />
                )}
              <div className="ca-resource-note">
                <h2>Where your work lives</h2>
                <p>
                  This app owns its records. Composer calls its reviewed
                  management API; it does not move them into the CMS database.
                </p>
                <p>
                  Private owner credentials stay on the server. This connection
                  is available to invited Composer administrators.
                </p>
                <a
                  href="/guide#resources"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Understand resources &amp; ownership ↗
                </a>
              </div>
            </aside>
          </div>
        </>
      )}
      <p className="ca-muted ca-footnote">
        Hello and Link Check keep their own workflows. Portable AI State remains
        fictional-only. Commerce connections are future work.
      </p>
    </section>
  );
}
export const pages: PluginAdminExports["pages"] = { "/apps": AppPage };
