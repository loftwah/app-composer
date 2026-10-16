import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  achievementUnsaved,
  type AchievementDraft,
} from "../achievements-admin";
import { tagUnsaved, type TagDraft } from "../tags-admin";
import {
  profileFileUnsaved,
  type ProfileFileDraft,
} from "../profile-settings-admin";
import { call } from "./api";
import type { AppID, LinkDraft, StyleDraft, Snapshot } from "./types";
export function useMiniapps() {
  const [achievementDraft, setAchievementDraft] = useState<AchievementDraft>();
  const [tagDraft, setTagDraft] = useState<TagDraft>();
  const [profileFileDraft, setProfileFileDraft] = useState<ProfileFileDraft>();
  const [linkDrafts, setLinkDrafts] = useState<Record<string, LinkDraft>>({});
  const [styleDrafts, setStyleDrafts] = useState<Record<string, StyleDraft>>(
    {},
  );
  const linkEdit = (id: string, value?: LinkDraft) =>
    setLinkDrafts((previous) => {
      const next = { ...previous };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  const styleEdit = (id: string, value?: StyleDraft) =>
    setStyleDrafts((previous) => {
      const next = { ...previous };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  const [selected, setSelected] = useState<AppID>(() => {
    if (typeof window === "undefined") return "guestbook";
    const values = new URLSearchParams(window.location.search).getAll("app");
    return values.length === 1 && values[0] === "showcase"
      ? "showcase"
      : "guestbook";
  });
  const [visible, setVisible] = useState(12);
  const [showHidden, setShowHidden] = useState(false);
  const [snapshots, setSnapshots] = useState<Partial<Record<AppID, Snapshot>>>(
    {},
  );
  const [errors, setErrors] = useState<Partial<Record<AppID, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<
    Partial<Record<AppID, Snapshot["config"]>>
  >({});
  const mutating = useRef(false);
  const generation = useRef(0);
  const unsaved =
    busy ||
    profileFileUnsaved(profileFileDraft) ||
    achievementUnsaved(achievementDraft) ||
    tagUnsaved(tagDraft) ||
    Object.values(linkDrafts).some((draft) =>
      (["title", "description", "url", "status"] as const).some(
        (key) => draft.from[key] !== draft.value[key],
      ),
    ) ||
    Object.values(styleDrafts).some(
      (draft) =>
        draft.from.icon !== draft.value.icon ||
        draft.from.pinned !== draft.value.pinned ||
        draft.from.group !== draft.value.group,
    ) ||
    Object.entries(drafts).some(([app, values]) =>
      Object.entries(values ?? {}).some(
        ([key, value]) => value !== snapshots[app as AppID]?.config[key],
      ),
    );
  useEffect(() => {
    if (!unsaved) return;
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, [unsaved]);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    const results = await Promise.allSettled(
      (["guestbook", "showcase"] as AppID[]).map((app) =>
        call(app, "snapshot"),
      ),
    );
    const next: Partial<Record<AppID, Snapshot>> = {},
      failures: Partial<Record<AppID, string>> = {};
    results.forEach((result, index) => {
      const app = (["guestbook", "showcase"] as AppID[])[index];
      if (result.status === "fulfilled") next[app] = result.value;
      else failures[app] = result.reason.message;
    });
    if (version === generation.current) {
      setSnapshots(next);
      setErrors(failures);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const act = async (
    app: AppID,
    action: string,
    fields: Record<string, unknown>,
    success: string,
    failed?: (message: string, code?: string) => void,
  ) => {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true);
    setMessage("Saving…");
    try {
      await call(app, action, fields);
      setMessage(success);
      await reload();
      return true;
    } catch (error) {
      const failure =
        error instanceof Error
          ? error.message
          : "The action failed. Refresh before retrying.";
      setMessage(failure);
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : undefined;
      failed?.(failure, code);
      if (
        code === "CONFLICT" ||
        ((action === "achievement" || action === "tag") && code !== "INVALID")
      )
        await reload();
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  const profileRequest = async (
    operation: "export" | "review" | "apply",
    fields: Record<string, unknown> = {},
  ) => {
    if (mutating.current)
      throw Error("Wait for the current app action to finish.");
    mutating.current = true;
    setBusy(true);
    try {
      const result = await call("showcase", "profile-settings", {
        operation,
        ...fields,
      });
      if (operation === "apply") {
        setDrafts((previous) => {
          const next = { ...previous };
          delete next.showcase;
          return next;
        });
        await reload();
        setMessage("Profile settings applied.");
      }
      return result;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The settings request could not be confirmed.",
      );
      if (
        operation === "apply" &&
        (!(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "INVALID")
      )
        await reload();
      throw error;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  const upload = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form),
      file = values.get("image") as File;
    if (file.size > 10000000) {
      setMessage("Choose an image under 10 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / bitmap.width, 1200 / bitmap.height),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const png = canvas.toDataURL("image/png").split(",")[1];
      if (png.length > 1400000) {
        setMessage("This image remains too large. Choose a smaller image.");
        return;
      }
      if (
        await act(
          "guestbook",
          "upload",
          {
            png,
            caption: values.get("caption"),
            author: values.get("author"),
            consent: values.has("consent"),
          },
          "Photo submitted for review. Approve it when it is ready to publish.",
        )
      )
        form.reset();
    } catch {
      setMessage(
        "This image could not be prepared. Choose a supported image file.",
      );
    }
  };
  const addLink = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (
      await act(
        "showcase",
        "link",
        Object.fromEntries(new FormData(form)),
        "Link saved as a draft. Publish it when it is ready.",
      )
    )
      form.reset();
  };
  const snapshot = snapshots[selected];
  const contributions = (snapshot?.items ?? []).filter(
    (item) => showHidden || ["approved", "pending"].includes(item.status),
  );
  const approved =
    snapshots.guestbook?.items.filter((item) => item.status === "approved") ??
    [];

  return {
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
    snapshots,
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
    upload,
    addLink,
    snapshot,
    contributions,
    approved,
  };
}
