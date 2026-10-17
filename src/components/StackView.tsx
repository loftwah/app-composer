import type { ReactElement } from "react";
import { STACK_APPS, declaredConfig } from "../lib/stacks.mjs";
import { themeTokens } from "../lib/stack-theme.mjs";

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
}
export interface StackViewDocument {
  version: number;
  name: string;
  description?: string;
  theme?: string;
  instances: StackInstanceView[];
}

const catalogue = STACK_APPS as Record<string, { name: string; purpose: string; route: string; standalone: string }>;

export function appView(id: string) {
  return catalogue[id] ?? null;
}

// Declared overrides only: a setting the creator actually chose on this
// instance. Defaults stay the app's business and are not restated as if the
// creator had chosen them.
export function configuredLines(instance: StackInstanceView) {
  const declared = (declaredConfig(instance.app) as { key: string; label: string }[] | null) ?? [];
  const config = instance.config ?? {};
  return declared
    .filter(field => typeof config[field.key] === "string" && config[field.key].trim())
    .map(field => ({ key: field.key, label: field.label, value: config[field.key] }));
}

export function StackView({
  document,
  link = false,
  compact = false,
  titleAs: Title = "h2",
}: {
  document: StackViewDocument;
  link?: boolean;
  compact?: boolean;
  /** The public page supplies the page's own h1; the editor preview reads as a section. */
  titleAs?: "h1" | "h2";
}): ReactElement {
  const tokens = themeTokens(document.theme);
  const instances = (document.instances ?? []).filter(instance => instance.visible !== false);
  const byId = new Map((document.instances ?? []).map(instance => [instance.id, instance]));
  return (
    <div
      className={`stack-view${compact ? " stack-view-compact" : ""}`}
      data-stack-theme={document.theme ?? "midnight"}
      style={{
        background: tokens.background,
        color: tokens.foreground,
        border: `1px solid ${tokens.border}`,
        borderRadius: 12,
        padding: compact ? "18px 18px 6px" : "28px 26px 10px",
      }}
    >
      <Title style={{ margin: "0 0 10px", fontSize: compact ? "1.35rem" : "1.7rem", lineHeight: 1.2 }}>{document.name}</Title>
      {document.description ? (
        <p style={{ margin: "0 0 18px", color: tokens.muted, maxWidth: "60ch" }}>{document.description}</p>
      ) : null}
      {instances.length === 0 ? (
        <p style={{ margin: "0 0 18px", color: tokens.muted }}>No visible app instances yet.</p>
      ) : null}
      {instances.map(instance => {
        const app = appView(instance.app);
        const sharedOf = instance.binding?.mode === "shared" ? byId.get(String(instance.binding.shareOf)) : undefined;
        const lines = configuredLines(instance);
        const external = Boolean(app && app.route.startsWith("http"));
        const href = app ? app.route : "#";
        return (
          <article key={instance.id} style={{ padding: "18px 0", borderTop: `1px solid ${tokens.border}` }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem", lineHeight: 1.3 }}>
              {link ? (
                <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} style={{ color: tokens.accent, textDecoration: "none" }}>
                  {instance.label}
                </a>
              ) : (
                instance.label
              )}
            </h3>
            {instance.caption ? <p style={{ margin: "0 0 8px", color: tokens.muted }}>{instance.caption}</p> : null}
            {app ? <p style={{ margin: "0 0 8px" }}>{app.purpose}</p> : null}
            {sharedOf ? (
              <p style={{ margin: "0 0 8px", color: tokens.muted, fontSize: ".92rem" }}>
                Shared — reuses the same app, records and settings as “{sharedOf.label}”. Edits here change both.
              </p>
            ) : null}
            {lines.length ? (
              <div style={{ margin: "0 0 10px", fontSize: ".92rem", display: "grid", gap: 4 }}>
                {lines.map(line => (
                  <p key={line.key} style={{ margin: 0 }}>
                    <span style={{ color: tokens.muted }}>{line.label}</span> {line.value}
                  </p>
                ))}
              </div>
            ) : null}
            {app ? (
              <p style={{ margin: 0, color: tokens.muted, fontSize: ".88rem" }}>
                {app.name}
                {external ? " · independent deployment" : " · mounted on App Composer"}
                {link ? (
                  <>
                    {" · "}
                    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} style={{ color: tokens.accent, textDecoration: "none" }}>
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
