import { PlatformPage } from "./platform-page";
import { EditorSession } from "./stacks/editor-session";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import { WorkspaceAccessPage } from "./workspace-access";
import { OutcomesPage } from "./outcomes";
import { MaintenancePage } from "./maintenance-page";
import { EnquiriesPage } from "./enquiries";
import { workspaceSelection, confirmWorkspace } from "./stacks/workspace-scope";
import {
  observeResourceRevision,
  resourcePreview,
  resourceDraft,
  resourceEditsDuringReuse,
} from "./stacks/resource-editor";
import type { ResourceBinding } from "./stacks/protocol";
import { ResourceContent, type ResourceContentAction } from "./stacks/resource-content";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import type { PluginAdminExports } from "emdash";
import {
  call as stackCall,
  type ActivationEntry,
  type DeclaredField,
  type Role,
  type Stack,
  type StackDocument,
  type StackPublication,
  type Workspace,
} from "./stacks/api";
import {
  CAPABILITIES,
  STACK_APPS,
  normaliseStack,
  declaredConfig,
} from "../lib/stacks.mjs";
import { StackView } from "../components/StackView";
import "./stacks-admin.css";

// The reviewed apps a stack can reference. Keep in step with src/lib/stacks.mjs.
const APPS: { id: string; name: string; purpose: string }[] = Object.entries(
  STACK_APPS as Record<string, { name: string; purpose: string }>,
).map(([id, app]) => ({ id, name: app.name, purpose: app.purpose }));
const ROLE_COPY: Record<Role, string> = {
  owner: "Owner — full control, including deleting a stack.",
  editor: "Editor — create, configure, publish and duplicate.",
  viewer:
    "Viewer — read and export only. You can open, preview and export, but nothing here changes the workspace.",
};
const can = (role: Role | undefined, action: string) =>
  Boolean(
    role && (CAPABILITIES as Record<string, string[]>)[role]?.includes(action),
  );
const newInstance = (app: string) => ({
  id: crypto.randomUUID(),
  app,
  label: APPS.find((entry) => entry.id === app)?.name ?? app,
  caption: "",
  visible: true,
  binding: { mode: "own" as const, shareOf: null },
  config: {},
});

type Draft = { document: StackDocument; generation: number };

export function StudioPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <WorkspaceStudio key={search} search={search} />;
}

// EmDash retains plugin pages during same-page query navigation. A confirmed
// route change starts a new editor scope, after the current editor's blocker
// has protected its unsaved work and pending operations.
function WorkspaceStudio({ search }: { search: string }) {
  const scope = useRef<{ workspace?: string; error?: Error }>({});
  const call = useCallback(async (action: string, fields: Record<string, unknown> = {}) => {
    if (scope.current.error) throw scope.current.error;
    const expected = scope.current.workspace;
    const data = await stackCall(action, { ...fields, ...(expected ? { workspace: expected } : {}) });
    const confirmed = confirmWorkspace(expected, data.workspace?.id);
    if (!scope.current.workspace) scope.current.workspace = confirmed;
    return data;
  }, []);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{
    message: string;
    stack?: string;
  }>();
  const [publications, setPublications] = useState<StackPublication[]>([]);
  const [activation, setActivation] = useState<ActivationEntry[]>([]);
  const [resources, setResources] = useState<ResourceBinding[]>([]);
  const [availableResources, setAvailableResources] = useState<
    ResourceBinding[]
  >([]);
  const [reuseChoices, setReuseChoices] = useState<Record<string, string>>({});
  const [managedInstance, setManagedInstance] = useState<string>();
  const [uncertainStacks, setUncertainStacks] = useState<string[]>([]);
  const [retainedSettings, setRetainedSettings] = useState<
    { instance: string; config: Record<string, string> }[]
  >([]);
  const [sidecarEpoch, setSidecarEpoch] = useState(0);
  const [sidecars, setSidecars] = useState<{
    stack?: string;
    resources: "loading" | "ready" | "failed";
    failures: string[];
  }>({ resources: "loading", failures: [] });
  const [newName, setNewName] = useState("");
  const [fallback, setFallback] = useState("");
  // The revision the server last acknowledged for this editor. Any local edit
  // bumps the generation; a response only marks the editor clean when the
  // generation it was sent for is still the current one.
  const session = useRef(new EditorSession());
  const requestGeneration = useRef(0);
  const pending = useRef(false);
  const latestDocument = useRef<StackDocument | undefined>(undefined);
  const sidecarGeneration = useRef(0);
  const latestNewName = useRef("");
  const requestedStack = useRef<string | null>(new URLSearchParams(search).get("stack"));

  useEffect(() => {
    try { scope.current.workspace = workspaceSelection(search); }
    catch (cause) { scope.current.error = cause instanceof Error ? cause : Error('Choose a workspace from Workspace access.'); }
  }, []);

  const current = useMemo(
    () => stacks.find((stack) => stack.id === selected),
    [stacks, selected],
  );
  const document = draft?.document;
  const role = workspace?.role;
  const editable = can(role, "save") && current?.status !== "archived";
  const resourcesReady =
    sidecars.stack === selected && sidecars.resources === "ready";
  const hasGuestbook = Boolean(
    document?.instances.some((instance) => instance.app === "guestbook"),
  );
  const needsReconciliation =
    Boolean(selected && uncertainStacks.includes(selected)) ||
    resources.some((resource) => resource.state === "unknown");

  const adopt = useCallback((stack: Stack) => {
    session.current.adopt(stack.id, stack.revision);
    latestDocument.current = structuredClone(stack.draft);
    setSelected(stack.id);
    setDraft({
      document: structuredClone(stack.draft),
      generation: session.current.generation,
    });
    setDirty(false);
    setConflict(undefined);
    setRetainedSettings([]);
    setSidecarEpoch((epoch) => epoch + 1);
  }, []);

  const load = useCallback(
    async (keepSelection?: string, { force = false } = {}) => {
      if (
        !force &&
        session.current.dirty &&
        !confirm("This stack has unsaved edits. Reload and lose them?")
      )
        return false;
      const checkpoint = session.current.capture();
      const request = ++requestGeneration.current;
      const data = await call("list");
      if (
        request !== requestGeneration.current ||
        !session.current.unchanged(checkpoint)
      )
        return false;
      setWorkspace(data.workspace);
      setStacks(data.stacks ?? []);
      const next =
        keepSelection ?? requestedStack.current ?? selected ?? data.stacks?.[0]?.id;
      requestedStack.current = null;
      const stack =
        data.stacks?.find((entry) => entry.id === next) ?? data.stacks?.[0];
      if (stack) adopt(stack);
      else {
        setSelected(undefined);
        setDraft(undefined);
        latestDocument.current = undefined;
        setDirty(false);
        session.current.adopt(undefined);
      }
      return true;
    },
    [adopt, dirty, selected],
  );

  useEffect(() => {
    setManagedInstance(undefined);
  }, [selected]);

  useEffect(() => {
    let live = true;
    load(undefined, { force: true })
      .catch((cause) => {
        if (live)
          setError(
            cause instanceof Error
              ? cause.message
              : "The workspace could not be loaded.",
          );
      })
      .finally(() => {
        if (live) setInitialLoading(false);
      });
    return () => {
      live = false;
      requestGeneration.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNavigationGuard({
    changed: dirty,
    pending: busy,
    onPending: () =>
      setMessage("Wait for the current stack operation before leaving. Your edits remain here."),
  });

  const run = async (work: () => Promise<string>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const note = await work();
      setMessage(note);
    } catch (cause: any) {
      if (cause?.code === "CONFLICT") {
        setConflict({ message: cause.message, stack: selected });
      } else {
        setError(
          cause?.message ||
            "The action did not complete. Your draft is still here.",
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const loadSidecars = useCallback(async (stackId: string) => {
    const request = ++sidecarGeneration.current;
    setSidecars({ stack: stackId, resources: "loading", failures: [] });
    const [history, configuration, owned] = await Promise.allSettled([
      call("publications", { stack: stackId }),
      call("configuration", { stack: stackId }),
      call("resources", { stack: stackId }),
    ]);
    if (
      session.current.stack !== stackId ||
      request !== sidecarGeneration.current
    )
      return;
    if (history.status === "fulfilled")
      setPublications(history.value.publications ?? []);
    if (configuration.status === "fulfilled")
      setActivation(configuration.value.configuration?.entries ?? []);
    if (owned.status === "fulfilled") {
      setResources(owned.value.resources ?? []);
      setAvailableResources(owned.value.availableResources ?? []);
    }
    setSidecars({
      stack: stackId,
      resources: owned.status === "fulfilled" ? "ready" : "failed",
      failures: [
        ...(history.status === "rejected" ? ["publication history"] : []),
        ...(configuration.status === "rejected" ? ["declared settings"] : []),
        ...(owned.status === "rejected" ? ["visitor book ownership and app operations"] : []),
      ],
    });
  }, []);

  useEffect(() => {
    setPublications([]);
    setActivation([]);
    setResources([]);
    setAvailableResources([]);
    setReuseChoices({});
    if (selected) void loadSidecars(selected);
  }, [selected, sidecarEpoch, loadSidecars]);

  const openStack = (id: string) =>
    run(async () => {
      if (id === selected) return "";
      if (
        session.current.dirty &&
        !confirm(
          "This stack has unsaved edits. Open another stack and lose them?",
        )
      )
        return "Kept editing.";
      const checkpoint = session.current.capture();
      const data = await call("open", { stack: id });
      if (!session.current.unchanged(checkpoint))
        return "Your newer edits are still here. Open the other stack again when ready.";
      if (!data.stack)
        throw Error(
          "The server did not confirm a saved stack. Your draft is still here.",
        );
      adopt(data.stack);
      return `Opened ${data.stack.name} at revision ${data.stack.revision}.`;
    });

  const update = (patch: Partial<StackDocument>) => {
    if (!latestDocument.current) return;
    session.current.edit();
    latestDocument.current = { ...latestDocument.current, ...patch };
    setDraft({
      document: latestDocument.current,
      generation: session.current.generation,
    });
    setDirty(true);
    setMessage("");
  };
  const updateInstance = (
    id: string,
    patch: Partial<StackDocument["instances"][number]>,
  ) => {
    if (!document) return;
    update({
      instances: document.instances.map((instance) =>
        instance.id === id ? { ...instance, ...patch } : instance,
      ),
    });
  };
  const move = (index: number, delta: number) => {
    if (!document) return;
    const next = [...document.instances];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ instances: next });
  };

  const create = () =>
    run(async () => {
      if (
        session.current.dirty &&
        !confirm("Create a new stack and leave this draft unsaved?")
      )
        return "Nothing created.";
      const checkpoint = session.current.capture();
      const data = await call("create", { name: newName });
      if (latestNewName.current === newName) {
        latestNewName.current = "";
        setNewName("");
      }
      if (session.current.unchanged(checkpoint))
        await load(data.stack?.id, { force: true });
      else if (data.stack) setStacks((list) => [data.stack!, ...list]);
      return `Created ${data.stack?.name}. It starts as a draft at /s/${data.stack?.slug}.`;
    });

  const acknowledge = (
    stack: Stack,
    checkpoint: ReturnType<EditorSession["capture"]>,
    savedDraft = false,
  ) => {
    if (!session.current.acknowledge(checkpoint, stack.revision, savedDraft))
      return false;
    setStacks((list) =>
      list.map((entry) => (entry.id === stack.id ? stack : entry)),
    );
    setDirty(session.current.dirty);
    return true;
  };

  const writeDraft = async (): Promise<Stack> => {
    if (!latestDocument.current || !current) throw Error("Open a stack first.");
    if (retainedSettings.length)
      throw Error(
        "Keep the app settings edited during sharing in a new instance before saving. Your edits remain visible below.",
      );
    if (hasGuestbook && !resourcesReady)
      throw Error("Load visitor book ownership before saving its settings.");
    const sent = session.current.capture();
    const payload = normaliseStack(
      resourceDraft(structuredClone(latestDocument.current), resources),
    ) as StackDocument;
    const data = await call("save", {
      stack: current.id,
      document: payload,
      expectedRevision: session.current.revision,
    });
    const stack = data.stack;
    if (
      !stack ||
      stack.id !== sent.stack ||
      JSON.stringify(stack.draft) !== JSON.stringify(payload)
    ) {
      throw Error(
        "The server did not confirm the submitted draft. Your edits are still here; reopen the saved revision before retrying.",
      );
    }
    if (!acknowledge(stack, sent, true))
      throw Error(
        "The server did not confirm a newer saved revision. Your draft is still here.",
      );
    return stack;
  };

  const save = () =>
    run(async () => {
      const stack = await writeDraft();
      return session.current.dirty
        ? `Saved revision ${stack.revision}. Your newer edits are still unsaved.`
        : `Saved draft revision ${stack.revision}.`;
    });

  const publish = () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      if (hasGuestbook && (!resourcesReady || needsReconciliation))
        throw Error("Load the visitor book ownership and check any unfinished operation before publishing.");
      const candidate = session.current.dirty ? await writeDraft() : current;
      const checkpoint = session.current.capture();
      const data = await call("publish", {
        stack: current.id,
        expectedRevision: candidate.revision,
      });
      const stack = data.stack;
      if (
        !stack ||
        stack.id !== current.id ||
        stack.publishedRevision !== candidate.revision
      ) {
        throw Error(
          "Publication was not confirmed. Your edits are still here; check the saved publication before retrying.",
        );
      }
      if (!acknowledge(stack, checkpoint))
        throw Error(
          "The publication acknowledgement was invalid. Your draft is still here.",
        );
      await loadSidecars(current.id);
      return (
        `Published saved revision ${stack.publishedRevision}. Public at /s/${current.slug}.` +
        (session.current.dirty ? " Your newer edits are still unsaved." : "")
      );
    });

  const resourceAction = (
    action: "applyResources" | "reconcileResources" | "reuseResource",
    fields: Record<string, unknown> = {},
  ) =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      if (action !== "reconcileResources" && !resourcesReady)
        throw Error("Load the visitor book ownership before changing app resources.");
      if (action === "applyResources" && needsReconciliation)
        throw Error("Check the previous app operation before applying again.");
      if (action === "reuseResource" && session.current.dirty)
        throw Error("Save your draft before choosing an existing resource.");
      let candidate =
        action === "applyResources" && session.current.dirty
          ? await writeDraft()
          : current;
      if (action === "reconcileResources") {
        // A lost response may have advanced the saved token. Read that token
        // before reconciliation, retaining every local field and generation.
        const beforeRead = session.current.capture();
        const latest = (await call("open", { stack: current.id })).stack;
        if (
          !latest || !observeResourceRevision(
            session.current, beforeRead, latest, current.draft,
          )
        )
          throw Object.assign(Error(
            "The saved draft changed in another window. Your expected revision and local edits are unchanged. Compare the saved version or explicitly choose Save mine on top.",
          ), { code: "CONFLICT" });
        setStacks((list) =>
          list.map((entry) => entry.id === latest.id ? latest : entry),
        );
        setDirty(session.current.dirty);
        candidate = latest;
      }
      const checkpoint = session.current.capture();
      let data: Awaited<ReturnType<typeof call>>;
      try {
        data = await call(action, {
          stack: current.id,
          expectedRevision: candidate.revision,
          ...fields,
        });
        if (
          !data.stack || data.stack.id !== checkpoint.stack ||
          (action !== "reuseResource" &&
            JSON.stringify(data.stack.draft) !== JSON.stringify(candidate.draft))
        )
          throw Error("The app operation did not confirm this saved draft. Keep your edits and check the operation before retrying.");
      } catch (cause) {
        // The request may have committed remotely before its acknowledgement was
        // lost. A new apply must reconcile rather than repeat that write.
        setUncertainStacks((list) => [...new Set([...list, current.id])]);
        throw cause;
      }
      const saved = data.stack!;
      const exact = session.current.unchanged(checkpoint);
      const sameRevision =
        session.current.acknowledgeUnchanged(checkpoint, saved.revision) &&
        ["unchanged", "unknown"].includes(data.outcome ?? "") &&
        JSON.stringify(saved.draft) === JSON.stringify(candidate.draft);
      if (sameRevision) {
        setStacks((list) =>
          list.map((entry) => (entry.id === saved.id ? saved : entry)),
        );
      } else if (!acknowledge(saved, checkpoint)) {
        setUncertainStacks((list) => [...new Set([...list, current.id])]);
        throw Error(
          "The app operation returned an invalid revision. Your draft is still here; check the operation before retrying.",
        );
      }
      if (action === "reuseResource" && exact && data.outcome === "applied")
        adopt(saved);
      else if (action === "reuseResource" && data.outcome === "applied" && latestDocument.current) {
        const retained = resourceEditsDuringReuse(
          latestDocument.current, candidate.draft, data.resources ?? [],
        );
        const merged = resourceDraft(latestDocument.current, data.resources ?? []);
        latestDocument.current = merged;
        setDraft({ document: merged, generation: session.current.generation });
        setRetainedSettings((entries) => [
          ...entries.filter((entry) => !retained.some((next) => next.instance === entry.instance)),
          ...retained,
        ]);
      }
      setResources(data.resources ?? []);
      const uncertain =
        data.outcome === "unknown" ||
        data.problems?.some((problem) => problem.outcome === "unknown") ||
        data.resources?.some((resource) => resource.state === "unknown");
      setUncertainStacks((list) =>
        uncertain
          ? [...new Set([...list, current.id])]
          : list.filter((id) => id !== current.id),
      );
      await loadSidecars(current.id);
      const notes = {
        applied:
          action === "reuseResource"
            ? "Reused the selected app resource and its confirmed settings. This instance is shared."
            : action === "reconcileResources"
              ? "Confirmed the app resource and its current configuration. Your saved draft and stack publication have not changed."
              : "Applied the saved app settings. Publish the stack to share these exact configuration references.",
        unchanged: "The app confirmed no change was needed.",
        refused:
          "The app refused the change. The previous publication is still available. Check the app operation to refresh its confirmed version before retrying.",
        partial: uncertain
          ? "Some app settings were applied. Check the operation before continuing; the stack publication has not changed."
          : "Some app settings were applied and others were refused. Review the reported problems before retrying; the stack publication has not changed.",
        unknown:
          "The app outcome is not confirmed. Check the operation before applying again; the stack publication has not changed.",
      };
      return (
        notes[data.outcome!] +
        (data.problems?.length
          ? " " + data.problems.map((problem) => problem.message).join(" ")
          : "") +
        (session.current.dirty
          ? action === "reuseResource"
            ? " Your newer local edits remain unsaved. Reopen the saved stack when ready to load its inherited settings."
            : " Your newer local edits remain unsaved."
          : "")
      );
    });

  const contentAction: ResourceContentAction = (instance, change, accept) =>
    run(async () => {
      if (!current) throw Error("Open a saved stack first.");
      const reconciling = change === null || change === "retry";
      if (!reconciling && needsReconciliation)
        throw Error("Check the unfinished app operation before changing visitor book content.");
      let candidate = current;
      if (reconciling) {
        const checkpoint = session.current.capture();
        const latest = (await call("open", { stack: current.id })).stack;
        if (!latest || !observeResourceRevision(session.current, checkpoint, latest, current.draft))
          throw Object.assign(Error(
            "The saved draft changed in another window. Your expected revision and local edits are unchanged. Compare the saved version before checking this content operation.",
          ), { code: "CONFLICT" });
        setStacks(list => list.map(entry => entry.id === latest.id ? latest : entry));
        candidate = latest;
      }
      const checkpoint = session.current.capture();
      let data: Awaited<ReturnType<typeof call>>;
      try {
        data = await call(change === "retry" ? "retryResourceContent" : change ? "moderateResource" : "reconcileResourceContent", {
          stack: current.id, instance, expectedRevision: candidate.revision,
          ...(!reconciling ? { change } : {}),
        });
        const saved = data.stack;
        if (!saved || saved.id !== checkpoint.stack ||
            JSON.stringify(saved.draft) !== JSON.stringify(candidate.draft) ||
            (data.book && data.book.instance !== instance))
          throw Error("The app did not confirm this saved stack and visitor book. Check the content operation before retrying.");
        const same = ["unchanged", "unknown"].includes(data.outcome ?? "") &&
          session.current.acknowledgeUnchanged(checkpoint, saved.revision);
        if (!same && !acknowledge(saved, checkpoint))
          throw Error("The app did not confirm a valid saved revision. Check the content operation before retrying.");
        if (same) setStacks(list => list.map(entry => entry.id === saved.id ? saved : entry));
      } catch (cause) {
        setUncertainStacks(list => [...new Set([...list, current.id])]);
        throw cause;
      }
      setDirty(session.current.dirty);
      setResources(data.resources ?? []);
      const unknown = data.outcome === "unknown" || !data.book || data.book.pending;
      setUncertainStacks(list => unknown
        ? [...new Set([...list, current.id])]
        : list.filter(id => id !== current.id));
      accept(data);
      const note = data.outcome === "applied"
        ? change ? "The app confirmed the visitor book change." : "Confirmed the content operation and current visitor book."
        : data.outcome === "unchanged" ? "The app confirmed no content change was needed."
        : data.outcome === "refused" ? "The app refused this change. Refresh the content or check the app operation before trying again."
        : "The content outcome is not confirmed. Check the content operation before changing this book again.";
      return note + (data.message ? " " + data.message : "") +
        (session.current.dirty ? " Your stack edits remain unsaved." : "");
    });

  const simple =
    (
      action: string,
      note: (data: Awaited<ReturnType<typeof call>>) => string,
      confirmText?: string,
    ) =>
    () =>
      run(async () => {
        if (!current) throw Error("Open a stack first.");
        if (confirmText && !confirm(confirmText)) return "Nothing changed.";
        const checkpoint = session.current.capture();
        const data = await call(action, {
          stack: current.id,
          expectedRevision: session.current.revision,
        });
        if (action === "duplicate") {
          if (!data.stack)
            throw Error(
              "The copy was not confirmed. Your draft is still here.",
            );
          setStacks((list) => [data.stack!, ...list]);
          return (
            note(data) +
            " Your original draft remains open. Open the copy from Saved stacks."
          );
        }
        if (action === "delete") {
          if (!data.deleted || data.deleted.id !== current.id)
            throw Error(
              "Deletion was not confirmed. Your draft is still here.",
            );
          if (!session.current.unchanged(checkpoint))
            return "The stack was deleted. Your newer local edits remain open; copy or export them before leaving.";
          setStacks((list) => list.filter((entry) => entry.id !== current.id));
          session.current.adopt(undefined);
          setSelected(undefined);
          setDraft(undefined);
          latestDocument.current = undefined;
          setDirty(false);
        } else {
          if (!data.stack || data.stack.id !== current.id)
            throw Error(
              "The change was not confirmed. Your draft is still here.",
            );
          if (!acknowledge(data.stack, checkpoint))
            throw Error(
              "The change acknowledgement was invalid. Your draft is still here.",
            );
        }
        return (
          note(data) +
          (session.current.dirty
            ? " Your unsaved edits remain in this editor."
            : "")
        );
      });

  const rollback = (
    action: "republish" | "restoreRevision",
    revision: number,
    label: string,
  ) =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const scope =
        action === "republish"
          ? `Make published revision ${revision} the public page again? The draft is left as it is.`
          : `Replace the open draft with published revision ${revision} as a new saved revision? Unsaved edits will be replaced; the public page does not change.`;
      if (
        !confirm(
          `${scope}\n\nNeither action restores app records, media or deletions, because Composer never owned them.`,
        )
      )
        return "Nothing changed.";
      const checkpoint = session.current.capture();
      const data = await call(action, {
        stack: current.id,
        revision,
        expectedRevision: session.current.revision,
      });
      if (!data.stack || data.stack.id !== current.id)
        throw Error("The change was not confirmed. Your draft is still here.");
      const replace =
        action === "restoreRevision" && session.current.unchanged(checkpoint);
      if (!acknowledge(data.stack, checkpoint))
        throw Error(
          "The change acknowledgement was invalid. Your draft is still here.",
        );
      if (replace) adopt(data.stack);
      await loadSidecars(current.id);
      return (
        label +
        (session.current.dirty ? " Your newer local edits remain unsaved." : "")
      );
    });

  // Export asks the server for the canonical shape, so the file always carries
  // the statement of exactly what it does and does not contain.
  const exportDocument = () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const data = await call("export", { stack: current.id });
      if (!data.export)
        throw Error("The export was not confirmed. Your draft is still here.");
      const payload = data.export;
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = current.slug + ".stack.json";
      link.click();
      URL.revokeObjectURL(url);
      return `Exported ${current.slug}.stack.json. It contains the composition and declared instance settings only — no app records, media, credentials or publication history.`;
    });

  // Import always creates a new draft. It never overwrites a stack and never
  // publishes, so a restore cannot change what visitors already see.
  const importFile = async (file: File) => {
    if (file.size > 120000) {
      setError(
        "Choose a stack file smaller than 120 KB. Your draft is still here.",
      );
      return;
    }
    const text = await file.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      setError(`${file.name} is not a JSON file exported from a stack.`);
      return;
    }
    if (
      !confirm(
        `Import ${file.name} as a new draft stack?\n\nImporting brings the composition and the declared instance settings. It does not bring app records, media, credentials or publication history, and it does not publish anything.`,
      )
    )
      return;
    await run(async () => {
      if (
        session.current.dirty &&
        !confirm("Import a new stack and replace the open unsaved draft?")
      )
        return "Kept editing.";
      const checkpoint = session.current.capture();
      const data = await call("import", { payload });
      if (session.current.unchanged(checkpoint))
        await load(data.stack?.id, { force: true });
      else if (data.stack) setStacks((list) => [data.stack!, ...list]);
      const imported = data.imported;
      if (!imported) return `Imported ${data.stack?.name} as a draft.`;
      return `Imported ${imported.name} as a draft: ${imported.instances} instance(s) across ${imported.apps.join(", ")}${imported.shared ? `, ${imported.shared} reusing another instance` : ""}${imported.configured ? `, ${imported.configured} with their own settings` : ""}. Nothing was published and no app records or media were copied.`;
    });
  };

  const copyShare = async () => {
    if (!current) return;
    const url = new URL("/s/" + current.slug, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Copied ${url}.`);
    } catch {
      setFallback(url);
    }
  };
  const shareUrl = current ? `/s/${current.slug}` : "";

  return (
    <section className="composer-admin ca-stacks">
      <div className="ca-heading">
        <div>
          <h1>Creator stacks</h1>
          <p>
            Save a named composition of reviewed mini-apps, configure each
            instance from the settings its app declares, preview the real page
            and publish one shareable revision. The apps keep their own records,
            media and credentials.
          </p>
        </div>
        {role !== "viewer" && (
          <button
            type="button"
            disabled={busy || initialLoading}
            onClick={() =>
              void run(async () =>
                (await load())
                  ? "Workspace refreshed."
                  : "Kept your local edits open.",
              )
            }
          >
            Refresh workspace
          </button>
        )}
      </div>
      <p>
        <a href={`/_emdash/admin/plugins/composer-stacks/workspaces${workspace ? `?workspace=${workspace.id}` : ''}`}
          aria-disabled={busy} onClick={event => { if (pending.current) event.preventDefault(); }}>
          Workspace access
        </a>
      </p>
      {workspace && (
      <p className="ca-muted">
          Workspace <strong>{workspace.name}</strong> ·{" "}
          {ROLE_COPY[workspace.role]}
        </p>
      )}
      {initialLoading && (
        <p role="status" className="ca-muted">Loading your workspace and saved stacks…</p>
      )}
      <p role="status" aria-live="polite" className="ca-message">
        {message}
      </p>
      {error && (
        <div role="alert" className="ca-stack-error">
          <p>{error}</p>
        </div>
      )}
      {conflict && conflict.stack === selected && (
        <div role="alert" className="ca-stack-conflict">
          <h2>Another window changed this stack</h2>
          <p>{conflict.message}</p>
          <p className="ca-muted">
            Your unsaved edits are still in this editor. Reload the saved
            version to compare, or save yours on top of the newer revision.
          </p>
          <div className="ca-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  (await load(selected, { force: true }))
                    ? "Reloaded the saved revision. Your unsaved edits were replaced."
                    : "Your newer edits remain open.",
                )
              }
            >
              Reload the saved version
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const latest = await call("open", { stack: selected });
                  if (!latest.stack || latest.stack.id !== selected)
                    throw Error("The saved revision was not confirmed.");
                  session.current.revision = latest.stack.revision;
                  setConflict(undefined);
                  const stack = await writeDraft();
                  return `Saved your version as revision ${stack.revision}.`;
                })
              }
            >
              Save mine on top
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConflict(undefined)}
            >
              Keep editing
            </button>
          </div>
        </div>
      )}
      <div className="ca-workspace">
        <div className="ca-main">
          {can(role, "create") && (
            <div className="ca-stack-create">
              <label>
                New stack name
                <input
                  value={newName}
                  maxLength={80}
                  onChange={(event) => {
                    latestNewName.current = event.target.value;
                    setNewName(event.target.value);
                  }}
                  placeholder="Loftwah front page"
                />
              </label>
              <button
                type="button"
                disabled={busy || !newName.trim()}
                onClick={() => void create()}
              >
                Create stack
              </button>
            </div>
          )}
          {!initialLoading && workspace && !document && (
            <p className="ca-muted">
              No stack yet.{" "}
              {can(role, "create")
                ? "Name one above to start."
                : "An owner or editor can create one."}
            </p>
          )}
          {document && current && (
            <>
              <div className="ca-stack-state">
                <span className={`ca-status ca-status-${current.status}`}>
                  {current.status}
                </span>
                <span className="ca-muted">
                  {dirty
                    ? `Unsaved edits on top of revision ${session.current.revision}`
                    : `Saved revision ${session.current.revision}`}
                  {current.publishedRevision
                    ? ` · public revision ${current.publishedRevision}`
                    : " · not published"}
                </span>
              </div>
              {sidecars.stack === selected && sidecars.failures.length > 0 && (
                <div className="ca-stack-error" role="alert">
                  <p>
                    Could not load {sidecars.failures.join(", ")}. Your draft is still here.
                    {!resourcesReady && " App actions wait for confirmed ownership."}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadSidecars(current.id)}
                  >
                    Retry stack details
                  </button>
                </div>
              )}
              <div className="ca-form ca-stack-form">
                <label>
                  Name
                  <input
                    value={document.name}
                    maxLength={80}
                    disabled={!editable}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={2}
                    maxLength={240}
                    disabled={!editable}
                    value={document.description}
                    onChange={(event) =>
                      update({ description: event.target.value })
                    }
                  />
                </label>
                <label>
                  Theme
                  <select
                    value={document.theme}
                    disabled={!editable}
                    onChange={(event) => update({ theme: event.target.value })}
                  >
                    <option value="midnight">Midnight</option>
                    <option value="daylight">Daylight</option>
                  </select>
                </label>
              </div>
              <h2>App instances</h2>
              <p className="ca-muted">
                Up to 12 instances. Add the same app twice to show it in two
                places: the second can reuse the first, which keeps one set of
                records and settings, or be configured on its own.
              </p>
              {document.instances.map((instance, index) => {
                const meta = APPS.find((entry) => entry.id === instance.app);
                const declared = (declaredConfig(instance.app) ??
                  []) as DeclaredField[];
                const shared = instance.binding?.mode === "shared";
                const resource = resources.find(
                  (entry) => entry.instance === instance.id,
                );
                const sharedResource = !shared && resource?.shared === true;
                const retained = retainedSettings.find((entry) => entry.instance === instance.id);
                const copiedSource = shared
                  ? document.instances.find(
                      (entry) => entry.id === instance.binding.shareOf,
                    )
                  : instance;
                const copiedResource = resources.find(
                  (entry) => entry.instance === copiedSource?.id,
                );
                const copiedSettings = copiedResource?.shared
                  ? copiedResource.configuration?.values ?? copiedSource?.config ?? {}
                  : copiedSource?.config ?? {};
                const siblings = document.instances.filter(
                  (entry) =>
                    entry.app === instance.app &&
                    entry.id !== instance.id &&
                    entry.binding?.mode !== "shared",
                );
                return (
                  <div
                    className="ca-card-row ca-stack-instance"
                    key={instance.id}
                  >
                    <div>
                      <h3>
                        {meta?.name ?? instance.app}{" "}
                        <span className="ca-muted">· {instance.label}</span>
                      </h3>
                      {workspace && (
                        <p className="ca-instance-analytics">
                          <a
                            href={`/_emdash/admin/plugins/composer-stacks/outcomes?workspace=${workspace.id}&stack=${current.id}&instance=${instance.id}`}
                          >
                            Analytics for this app instance
                          </a>
                        </p>
                      )}
                      <label>
                        Label
                        <input
                          value={instance.label}
                          maxLength={60}
                          disabled={!editable}
                          onChange={(event) =>
                            updateInstance(instance.id, {
                              label: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Caption
                        <input
                          value={instance.caption}
                          maxLength={200}
                          disabled={!editable}
                          onChange={(event) =>
                            updateInstance(instance.id, {
                              caption: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="ca-check">
                        <input
                          type="checkbox"
                          checked={instance.visible}
                          disabled={!editable}
                          onChange={(event) =>
                            updateInstance(instance.id, {
                              visible: event.target.checked,
                            })
                          }
                        />{" "}
                        Visible on the published page
                      </label>
                      {!shared && !sharedResource &&
                        (instance.app !== "guestbook" || resourcesReady) && (
                        <>
                          <p className="ca-muted">{meta?.purpose}</p>
                          <fieldset
                            disabled={!editable}
                            className="ca-stack-binding"
                          >
                            <legend>How this instance is owned</legend>
                            <label className="ca-check">
                              <input
                                type="radio"
                                name={`binding-${instance.id}`}
                                checked={instance.binding?.mode !== "shared"}
                                onChange={() =>
                                  updateInstance(instance.id, {
                                    binding: { mode: "own", shareOf: null },
                                  })
                                }
                              />
                              Independently configured
                            </label>
                            {siblings.length > 0 && (
                              <label className="ca-check">
                                <input
                                  type="radio"
                                  name={`binding-${instance.id}`}
                                  checked={shared}
                                  onChange={() =>
                                    updateInstance(instance.id, {
                                      binding: {
                                        mode: "shared",
                                        shareOf: siblings[0].id,
                                      },
                                      config: {},
                                    })
                                  }
                                />
                                Reuse “{siblings[0].label}” ({meta?.name}{" "}
                                already in this stack)
                              </label>
                            )}
                          </fieldset>
                        </>
                      )}
                      {shared && (
                        <p className="ca-stack-shared">
                          Shared with “
                          {document.instances.find(
                            (entry) => entry.id === instance.binding?.shareOf,
                          )?.label ?? "another instance"}
                          ”. The app keeps one set of records, so edits and
                          approvals appear in both places.
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() =>
                              updateInstance(instance.id, {
                                binding: { mode: "own", shareOf: null },
                              })
                            }
                          >
                            Make this one independently configured
                          </button>
                        </p>
                      )}
                      {instance.app === "guestbook" && editable && resourcesReady &&
                        copiedResource?.configuration &&
                        current?.draft.instances.some(entry => entry.id === instance.id &&
                          JSON.stringify(entry.binding) === JSON.stringify(instance.binding)) && (
                          <button type="button" disabled={busy}
                            onClick={() => setManagedInstance(instance.id)}>
                            Manage saved visitor book content
                          </button>
                        )}
                      {instance.app === "guestbook" && !shared && (
                        <div className="ca-resource-status">
                          <p>
                            {!resourcesReady
                              ? sidecars.stack === selected && sidecars.resources === "failed"
                                ? "Visitor book ownership could not be loaded. Retry stack details or check the app operation before continuing."
                                : "Loading visitor book ownership and app operations…"
                              : resource?.state === "ready" && resource.configuration
                                ? `${sharedResource ? "Shared" : "Owned"} visitor book · ${resource.resource.slice(0, 8)} · configuration ${resource.configuration.revision}`
                              : resource?.state === "unknown"
                                ? "The app operation needs checking before another apply."
                                : resource?.state === "refused"
                                  ? "The app refused the last change. Your published stack is unchanged."
                                  : resource?.state === "reserved"
                                    ? `Visitor book reserved · ${resource.resource.slice(0, 8)}. Its settings are not fully activated.`
                                    : "A new visitor book will be created when you apply this stack’s settings."}
                          </p>
                          {resourcesReady && resource?.configuration && (
                            <p>
                              <a href={resource.configuration.path} target="_blank" rel="noopener noreferrer">
                                Open confirmed visitor book
                              </a>
                            </p>
                          )}
                          {resourcesReady && sharedResource && (
                            <>
                              <p className="ca-stack-shared">
                              This visitor book shares its records, moderation
                              and settings with other uses. Its confirmed
                              settings are inherited here.
                              </p>
                              <details className="ca-stack-config">
                                <summary>Inherited app settings (read only)</summary>
                                <dl>
                                  {declared.map((field) => (
                                    <div key={field.key}>
                                      <dt>{field.label}</dt>
                                      <dd>{resource?.configuration?.values[field.key] || "Unset"}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </details>
                            </>
                          )}
                          {resourcesReady && availableResources.some(
                            (entry) =>
                              entry.state === "ready" &&
                              entry.configuration &&
                              entry.resource !== resource?.resource,
                          ) && (
                            <details>
                              <summary>Reuse an existing visitor book</summary>
                              <p>
                                Reusing shares one set of records and approvals.
                                Save this draft first.
                              </p>
                              <label>
                                Visitor book in this workspace
                                <select
                                  value={reuseChoices[instance.id] ?? ""}
                                  disabled={
                                    !editable || busy || dirty ||
                                    !resourcesReady || needsReconciliation
                                  }
                                  onChange={(event) =>
                                    setReuseChoices((choices) => ({
                                      ...choices,
                                      [instance.id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">
                                    Choose a visitor book
                                  </option>
                                  {availableResources
                                    .filter(
                                      (entry) =>
                                        entry.state === "ready" &&
                                        entry.configuration &&
                                        entry.resource !== resource?.resource,
                                    )
                                    .map((entry) => (
                                      <option
                                        key={entry.resource}
                                        value={entry.resource}
                                      >
                                        {entry.configuration?.values.title ||
                                          "Visitor book"}{" "}
                                        · {entry.resource.slice(0, 8)}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                disabled={
                                  !editable ||
                                  busy ||
                                  dirty ||
                                  !resourcesReady ||
                                  !reuseChoices[instance.id] ||
                                  needsReconciliation
                                }
                                onClick={() =>
                                  void resourceAction("reuseResource", {
                                    instance: instance.id,
                                    resource: reuseChoices[instance.id],
                                  })
                                }
                              >
                                Reuse selected visitor book
                              </button>
                            </details>
                          )}
                        </div>
                      )}
                      {retained && (
                        <section className="ca-resource-status" aria-label="Retained app setting edits">
                          <p>
                            Settings you edited while sharing this visitor book are kept here.
                            The shared book uses its confirmed settings; keep these edits in a new independent instance.
                          </p>
                          <dl>
                            {Object.entries(retained.config).map(([key, value]) => (
                              <div key={key}><dt>{declared.find((field) => field.key === key)?.label ?? key}</dt><dd>{value || "Unset"}</dd></div>
                            ))}
                          </dl>
                          <button
                            type="button"
                            disabled={!editable || busy || document.instances.length >= 12}
                            onClick={() => {
                              update({ instances: [...document.instances, {
                                ...newInstance(instance.app),
                                label: `${instance.label.slice(0, 42)} edited settings`,
                                caption: instance.caption,
                                config: { ...retained.config },
                              }] });
                              setRetainedSettings((entries) => entries.filter((entry) => entry.instance !== instance.id));
                            }}
                          >
                            Keep edited settings in a new instance
                          </button>
                        </section>
                      )}
                      {!shared && !sharedResource && declared.length > 0 && (
                        <details className="ca-stack-config">
                          <summary>
                            Settings this app declares
                            {Object.keys(instance.config ?? {}).length
                              ? ` · ${Object.keys(instance.config).length} set here`
                              : ""}
                          </summary>
                          {declared.map((field) => (
                            <label key={field.key}>
                              {field.label}
                              {field.options?.length ? (
                                <select
                                  value={instance.config?.[field.key] ?? ""}
                                  disabled={
                                    !editable ||
                                    (instance.app === "guestbook" && !resourcesReady)
                                  }
                                  onChange={(event) => {
                                    const next = { ...(instance.config ?? {}) };
                                    if (event.target.value)
                                      next[field.key] = event.target.value;
                                    else delete next[field.key];
                                    updateInstance(instance.id, {
                                      config: next,
                                    });
                                  }}
                                >
                                  <option value="">
                                    Use the app’s default (
                                    {field.default || "unset"})
                                  </option>
                                  {field.options.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={instance.config?.[field.key] ?? ""}
                                  maxLength={field.maxLength ?? 240}
                                  disabled={
                                    !editable ||
                                    (instance.app === "guestbook" && !resourcesReady)
                                  }
                                  placeholder={field.default}
                                  onChange={(event) => {
                                    const next = { ...(instance.config ?? {}) };
                                    if (event.target.value)
                                      next[field.key] = event.target.value;
                                    else delete next[field.key];
                                    updateInstance(instance.id, {
                                      config: next,
                                    });
                                  }}
                                />
                              )}
                            </label>
                          ))}
                          <p className="ca-muted">
                            {instance.app === "guestbook"
                              ? "Apply these settings to this visitor book, then publish the stack. Saving a draft alone does not change the visitor book."
                              : "These declared settings are saved with this stack. This app’s existing public destination is shared; independent activation is not available here yet."}
                          </p>
                        </details>
                      )}
                      {!shared && declared.length === 0 && (
                        <p className="ca-muted">
                          {meta?.name} does not publish a configuration
                          contract, so this instance can only reuse what the app
                          already holds.
                        </p>
                      )}
                    </div>
                    {editable && (
                      <div className="ca-actions">
                        {instance.app === "guestbook" && (
                          <button
                            type="button"
                            disabled={
                              busy || document.instances.length >= 12 || !resourcesReady
                            }
                            onClick={() =>
                              update({
                                instances: [
                                  ...document.instances,
                                  {
                                    ...newInstance(instance.app),
                                    label: `${instance.label.slice(0, 50)} copy`,
                                    caption: instance.caption,
                                    config: {
                                      ...copiedSettings,
                                    },
                                  },
                                ],
                              })
                            }
                          >
                            Duplicate settings into a new instance
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          disabled={
                            busy || index === document.instances.length - 1
                          }
                          onClick={() => move(index, 1)}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              retained &&
                              !confirm("Remove this app and discard the app setting edits kept here?")
                            ) return;
                            setRetainedSettings((entries) =>
                              entries.filter((entry) => entry.instance !== instance.id),
                            );
                            update({
                              instances: document.instances.filter(
                                (entry) => entry.id !== instance.id,
                              ),
                            });
                          }}
                        >
                          {retained ? "Remove app and retained edits" : "Remove"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {current && editable && managedInstance &&
                document.instances.some(instance => instance.id === managedInstance) && (
                  <ResourceContent key={`${current.id}:${managedInstance}`}
                    request={call}
                    stack={current} instance={managedInstance} busy={busy}
                    uncertain={needsReconciliation} onAction={contentAction}
                    onClose={() => setManagedInstance(undefined)} />
                )}
              {editable && (
                <div className="ca-stack-add">
                  {APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      disabled={busy || document.instances.length >= 12}
                      title={app.purpose}
                      onClick={() =>
                        update({
                          instances: [
                            ...document.instances,
                            newInstance(app.id),
                          ],
                        })
                      }
                    >
                      Add {app.name}
                    </button>
                  ))}
                </div>
              )}
              {document.instances.some(
                (instance) => instance.app === "guestbook",
              ) && (
                <section
                  className="ca-resource-actions"
                  aria-label="App configuration activation"
                >
                  <h2>Apply visitor book settings</h2>
                  <p>
                    Each new owned instance gets its own visitor book. Apply
                    prepares the saved settings; Publish chooses what the stack
                    shares. Existing published configurations stay available.
                  </p>
                  {needsReconciliation && (
                    <p role="status">
                      The previous app operation is not fully confirmed. Check
                      it before applying or publishing again.
                    </p>
                  )}
                  {editable && (
                    <div className="ca-actions">
                      <button
                        type="button"
                        disabled={busy || !resourcesReady || needsReconciliation}
                        onClick={() => void resourceAction("applyResources")}
                      >
                        Save and apply app settings
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void resourceAction("reconcileResources")
                        }
                      >
                        Check app operation
                      </button>
                    </div>
                  )}
                </section>
              )}
              <div className="ca-stack-actions">
                {editable && (
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void save()}
                  >
                    Save draft
                  </button>
                )}
                {can(role, "publish") && (
                  <button
                    type="button"
                    disabled={
                      busy || (hasGuestbook && (!resourcesReady || needsReconciliation))
                    }
                    onClick={() => void publish()}
                  >
                    Publish
                  </button>
                )}
                {current.status === "published" && can(role, "unpublish") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={simple(
                      "unpublish",
                      () =>
                        "Unpublished. The public address now returns 404 until you publish again. The stored publications are kept.",
                      "Unpublish this stack? The public address stops serving it immediately. The draft and its publication history are kept.",
                    )}
                  >
                    Unpublish
                  </button>
                )}
                {can(role, "duplicate") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={simple(
                      "duplicate",
                      (data) =>
                        `Duplicated as ${data.stack?.name}. It is a separate draft with new instance identities, and the same shared-versus-independent structure.`,
                    )}
                  >
                    Duplicate
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void exportDocument()}
                >
                  Export JSON
                </button>
                {can(role, "create") && (
                  <label className="ca-stack-import">
                    Import a stack file
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void importFile(file);
                      }}
                    />
                  </label>
                )}
                {can(role, "archive") &&
                  (current.status !== "archived" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={simple(
                        "archive",
                        () =>
                          "Archived. It stays out of the public address until restored.",
                        "Archive this stack? Its public address stops serving, and the draft is locked until you restore it.",
                      )}
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={simple(
                        "restore",
                        () =>
                          "Restored as a draft. Publish again when you want it public.",
                      )}
                    >
                      Restore
                    </button>
                  ))}
                {can(role, "delete") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={simple(
                      "delete",
                      (data) =>
                        `Deleted ${data.deleted?.name}. Its configuration and publication history are gone. App records and media were never part of it and are untouched.`,
                      "Delete this stack permanently, including any unsaved edits in this editor? Its configuration and publication history are removed. The apps keep their own records, media and settings.",
                    )}
                  >
                    Delete stack
                  </button>
                )}
              </div>
              <section
                className="ca-stack-preview"
                aria-labelledby="stack-preview-title"
              >
                <h2 id="stack-preview-title">Preview</h2>
                <p className="ca-muted">
                  The same renderer the published page uses, applied to your
                  draft. A preview never publishes anything.
                </p>
                <StackView document={resourcesReady ? resourcePreview(document, resources) : document} />
              </section>
              {publications.length > 0 && (
                <section className="ca-stack-history">
                  <h2>Published revisions</h2>
                  <p className="ca-muted">
                    Every revision that was actually activated. Rolling one back
                    changes Composer’s published configuration only; app
                    content, media and deletions are not restored.
                  </p>
                  <ul>
                    {publications.map((publication) => (
                      <li key={publication.revision}>
                        <span>
                          Revision {publication.revision}
                          {publication.revision === current.publishedRevision
                            ? " · public now"
                            : ""}
                          <small> {publication.publishedAt}</small>
                        </span>
                        {can(role, "rollback") && (
                          <span className="ca-actions">
                            <button
                              type="button"
                              disabled={
                                busy ||
                                publication.revision ===
                                  current.publishedRevision
                              }
                              onClick={() =>
                                void rollback(
                                  "republish",
                                  publication.revision,
                                  `Published revision ${publication.revision} is public again.`,
                                )
                              }
                            >
                              Publish this revision
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void rollback(
                                  "restoreRevision",
                                  publication.revision,
                                  `Revision ${publication.revision} is in the draft as a new revision.`,
                                )
                              }
                            >
                              Restore into draft
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
        <aside className="ca-aside">
          <h2>Saved stacks</h2>
          <ul className="ca-stack-list">
            {stacks.map((stack) => (
              <li key={stack.id}>
                <button
                  type="button"
                  aria-pressed={stack.id === selected}
                  disabled={busy}
                  onClick={() => void openStack(stack.id)}
                >
                  <strong>{stack.name}</strong>
                  <span className={`ca-status ca-status-${stack.status}`}>
                    {stack.status}
                  </span>
                  <small>
                    revision {stack.revision} · /s/{stack.slug}
                  </small>
                </button>
                {workspace && (
                  <a
                    className="ca-stack-analytics"
                    href={`/_emdash/admin/plugins/composer-stacks/outcomes?workspace=${workspace.id}&stack=${stack.id}`}
                  >
                    Analytics
                  </a>
                )}
              </li>
            ))}
            {!initialLoading && workspace && !stacks.length && (
              <li className="ca-muted">No stacks yet.</li>
            )}
          </ul>
          {current && (
            <div className="ca-resource-note">
              <h2>Share and ownership</h2>
              <p>
                Public address:{" "}
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  {shareUrl} ↗
                </a>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void copyShare()}
              >
                Copy share link
              </button>
              <p>
                <a
                  className="button secondary"
                  href={`/_emdash/admin/plugins/composer-stacks/outcomes?workspace=${workspace?.id ?? ""}&stack=${current.id}`}
                >
                  Open analytics for this stack
                </a>
              </p>
              {fallback && (
                <label className="ca-share-fallback">
                  Share address
                  <input
                    readOnly
                    value={fallback}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              )}
              <p className="ca-muted">
                Drafts are never served at this address. Publishing stores an
                immutable revision; later edits stay private until you publish
                again. Export contains configuration only — app records, media
                and credentials stay with the apps.
              </p>
              {activation.length > 0 && (
                <div className="ca-config-status">
                  <h3>App configuration</h3>
                  <ul>
                    {activation.map((entry) => (
                      <li key={entry.instanceId}>
                        <strong>{entry.name}</strong>{" "}
                        {entry.configurable ? (
                          <span>
                            {entry.settings?.filter(
                              (setting) => setting.overridden,
                            ).length
                              ? `${entry.settings.filter((setting) => setting.overridden).length} declared setting(s) stored with this stack; apply through the app’s owner API.`
                              : "Everything uses the app’s own defaults."}
                          </span>
                        ) : (
                          <span>{entry.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
export const pages: PluginAdminExports["pages"] = {
  "/stacks": StudioPage,
  "/platform": PlatformPage,
  "/workspaces": WorkspaceAccessPage,
  "/outcomes": OutcomesPage,
  "/maintenance": MaintenancePage,
  "/enquiries": EnquiriesPage,
};
