import { ProfileSettings } from "./profile-settings-admin";
import type { PluginAdminExports } from "emdash";
import { appSettings } from "../lib/app-settings.mjs";
import { Settings } from "./miniapps/settings";
import { GuestbookWorkspace } from "./miniapps/guestbook-workspace";
import { ShowcaseWorkspace } from "./miniapps/showcase-workspace";
import { useMiniapps } from "./miniapps/use-miniapps";
import { CollectionSources } from "./miniapps/collection-sources";
import { ShareCard } from "./miniapps/share-card";
import type { AppID, SiteID } from "./miniapps/types";
import reference from "../../config/creator-hub-reference.json";
import "./miniapps-admin.css";
const names = { guestbook: "Here / there", showcase: "Linkarooie" };
const siteNames: Record<
  SiteID,
  { label: string; short: string; note: string }
> = {
  "creator-hub": {
    label: "Creator Hub reference",
    short: "Fictional creator · operator account",
    note: "Mara Quinn’s reference pair. Both apps run in the operator’s Cloudflare account and on the operator’s domain; each keeps its own repository, Worker, database and owner credential.",
  },
  operator: {
    label: "Operator pair",
    short: "guestbook.loftwah.com · showcase.loftwah.com",
    note: "The original operator-owned pair used for App Composer’s hosted demos.",
  },
};
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
    site,
    changeSite,
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
      <nav className="ca-sites" aria-label="Choose the managed deployment">
        {(["creator-hub", "operator"] as SiteID[]).map((id) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            aria-pressed={site === id}
            onClick={() => changeSite(id)}
          >
            {siteNames[id].label} <span>{siteNames[id].short}</span>
          </button>
        ))}
      </nav>
      <p className="ca-site-note">{siteNames[site].note}</p>
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
        active={selected === "showcase" && site === "operator"}
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
                · source pinned to <code>{snapshot.revision.slice(0, 7)}</code>
              </p>
              <p className="ca-muted">
                {site === "creator-hub"
                  ? "Fictional reference content in the operator’s account. Each app keeps its own Worker, storage and owner credential."
                  : "The original operator pair used for Composer’s hosted demos."}
              </p>
            </div>
            <div className="ca-links">
              <a
                href={
                  site === "creator-hub"
                    ? reference.apps[selected].origin
                    : "/" + selected + "/"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Open live app ↗
              </a>
              <a
                href={
                  (site === "creator-hub"
                    ? reference.apps[selected].origin
                    : "https://" + selected + ".loftwah.com") + "/build.json"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Release identity ↗
              </a>
              {site === "creator-hub" && (
                <a
                  href={reference.apps[selected].repository}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Independent source ↗
                </a>
              )}
              {site === "operator" && (
                <a
                  href={"https://" + selected + ".loftwah.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Standalone ↗
                </a>
              )}
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
                  site={site}
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
                {site === "creator-hub" ? (
                  <>
                    <p>
                      This reference pair runs in the operator’s Cloudflare
                      account. Here / there and Linkarooie each keep their own
                      Worker, database
                      {selected === "guestbook" ? " and photo bucket" : ""} and
                      owner credential.
                    </p>
                    <p>
                      The panel calls each app’s own management API. It does not
                      copy the contribution or private media into Composer, and
                      the app enforces who may see it.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      This app owns its records. Composer calls its reviewed
                      management API; it does not move them into the CMS
                      database.
                    </p>
                    <p>
                      Private owner credentials stay on the server. This
                      connection is available to invited Composer
                      administrators.
                    </p>
                  </>
                )}
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
