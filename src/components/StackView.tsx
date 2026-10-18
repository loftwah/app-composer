import type { ReactElement } from "react";
import { STACK_APPS, declaredConfig } from "../lib/stacks.mjs";
import { STACK_THEMES, themeTokens } from "../lib/stack-theme.mjs";
import "../styles/stack-view.css";

// One renderer for the stack document. The native editor previews with it and
// the published page renders with it, so configuration, theme, ordering and
// visibility are interpreted in exactly one place. The apps keep their own
// records, media and credentials; this component only names and links them.
export interface StackInstanceView {
  id: string;
  app: string;
  label: string;
  caption?: string;
  visible?: boolean;
  binding?: { mode?: string; shareOf?: string | null };
  config?: Record<string, string>;
  resource?: {
    id: string;
    configurationRevision: number;
    digest: string;
    source: string;
    path: string;
    shared: boolean;
  };
}
export interface StackViewDocument {
  version: number;
  name: string;
  description?: string;
  theme?: string;
  instances: StackInstanceView[];
}

const catalogue = STACK_APPS as Record<
  string,
  { name: string; purpose: string; route: string; standalone: string }
>;

export function appView(id: string) {
  return catalogue[id] ?? null;
}

// Declared overrides only: a setting the creator actually chose on this
// instance. Defaults stay the app's business and are not restated as if the
// creator had chosen them.
export function configuredLines(instance: StackInstanceView) {
  const declared =
    (declaredConfig(instance.app) as { key: string; label: string }[] | null) ??
    [];
  const config = instance.config ?? {};
  return declared
    .filter(
      (field) =>
        typeof config[field.key] === "string" && config[field.key].trim(),
    )
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: config[field.key],
    }));
}

export function StackView({
  document,
  link = false,
  compact = false,
  titleAs: Title = "h2",
  outcomes,
}: {
  document: StackViewDocument;
  link?: boolean;
  compact?: boolean;
  /** The public page supplies the page's own h1; the editor preview reads as a section. */
  titleAs?: "h1" | "h2";
  /** Set only by the published public page; native previews never collect. */
  outcomes?: { slug: string; publication: number };
}): ReactElement {
  const tokens = themeTokens(document.theme);
  const theme =
    Object.entries(STACK_THEMES).find(
      ([, candidate]) => candidate === tokens,
    )?.[0] ?? "midnight";
  const instances = (document.instances ?? []).filter(
    (instance) => instance.visible !== false,
  );
  const byId = new Map(
    (document.instances ?? []).map((instance) => [instance.id, instance]),
  );
  return (
    <div
      className={`stack-view${compact ? " stack-view-compact" : ""}`}
      data-stack-theme={theme}
      data-outcome-slug={outcomes?.slug}
      data-outcome-publication={outcomes?.publication}
    >
      <Title className="stack-view-title">{document.name}</Title>
      {document.description ? (
        <p className="stack-view-description">{document.description}</p>
      ) : null}
      {instances.length === 0 ? (
        <p className="stack-view-empty">No visible app instances yet.</p>
      ) : null}
      {instances.map((instance) => {
        const app = appView(instance.app);
        const sharedOf =
          instance.binding?.mode === "shared"
            ? byId.get(String(instance.binding.shareOf))
            : undefined;
        const lines = configuredLines(instance);
        const external = Boolean(app && app.route.startsWith("http"));
        const resource =
          instance.app === "guestbook" &&
          instance.resource &&
          /^[a-z0-9-]{6,64}$/.test(instance.resource.id) &&
          Number.isSafeInteger(instance.resource.configurationRevision) &&
          instance.resource.configurationRevision > 0 &&
          instance.resource.path ===
            `/guestbook/r/${instance.resource.id}/c/${instance.resource.configurationRevision}/`
            ? instance.resource
            : undefined;
        const href = resource?.path ?? (app ? app.route : "#");
        return (
          <article key={instance.id} className="stack-view-instance">
            <h3 className="stack-instance-title">
              {link ? (
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                >
                  {instance.label}
                </a>
              ) : (
                instance.label
              )}
            </h3>
            {instance.caption ? (
              <p className="stack-instance-caption">{instance.caption}</p>
            ) : null}
            {app ? (
              <p className="stack-instance-purpose">{app.purpose}</p>
            ) : null}
            {sharedOf ? (
              <p className="stack-instance-shared">
                Shared — reuses the same app, records and settings as “
                {sharedOf.label}”. Edits here change both.
              </p>
            ) : null}
            {!sharedOf && resource?.shared ? (
              <p className="stack-instance-shared">
                Shared visitor book — records, settings and moderation are
                shared with its other uses.
              </p>
            ) : null}
            {lines.length ? (
              <div className="stack-instance-config">
                {lines.map((line) => (
                  <p key={line.key}>
                    <span className="stack-instance-config-label">
                      {line.label}
                    </span>{" "}
                    {line.value}
                  </p>
                ))}
              </div>
            ) : null}
            {app ? (
              <p className="stack-instance-meta">
                {app.name}
                {external
                  ? " · independent deployment"
                  : " · mounted on App Composer"}
                {link ? (
                  <>
                    {" · "}
                    <a
                      href={href}
                      data-outcome-instance={outcomes && instance.app !== "state" ? instance.id : undefined}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                    >
                      Open
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default StackView;
