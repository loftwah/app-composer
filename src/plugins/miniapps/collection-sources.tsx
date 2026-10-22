import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  collectionSourcesReply,
  collectionItemsReply,
  collectionInvitationReply,
  collectionReceipt,
  type CollectionReceipt,
} from "../../lib/miniapp-collection-contract";
import type { CollectionRequest } from "./collection-api";
import { useNavigationGuard } from "../stacks/use-navigation-guard";

type Sources = z.infer<typeof collectionSourcesReply>;
type Book = z.infer<typeof collectionItemsReply>;
type Invitation = z.infer<typeof collectionInvitationReply>;
const invitationLabels: Record<string, string> = {
  open: "Open · visitors can send a note for review",
  paused: "Paused · no send action is shown",
  closed: "Closed · no send action is shown",
  full: "Review queue full · no send action is shown",
  unavailable: "Unavailable · Linkarooie cannot reach the Guestbook",
  none: "Not linked · no contribution action is shown",
};
const reason = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The selected app could not be checked.";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Kept mounted above the app switch, so an uncertain reference and its recovery
// control survive switching to Guestbook or refreshing unrelated app snapshots.
export function CollectionSources({
  active,
  busy,
  request,
}: {
  active: boolean;
  busy: boolean;
  request: CollectionRequest;
}) {
  const [sources, setSources] = useState<Sources>();
  const [workspace, setWorkspace] = useState("");
  const [choice, setChoice] = useState("");
  const [book, setBook] = useState<Book>();
  const [item, setItem] = useState("");
  const [receipt, setReceipt] = useState<CollectionReceipt>();
  const [invitation, setInvitation] = useState<Invitation>();
  const [invitationError, setInvitationError] = useState("");
  const [message, setMessage] = useState(
    "Choose a workspace to load its saved visitor books.",
  );
  const [loading, setLoading] = useState(false);
  const running = useRef(false);
  const uncertain = receipt?.outcome === "unknown";
  useNavigationGuard({
    changed: uncertain,
    pending: loading,
    onPending: () =>
      setMessage("Wait for this collection check to finish before leaving."),
  });
  const run = async (work: () => Promise<void>) => {
    if (running.current || busy) return;
    running.current = true;
    setLoading(true);
    try {
      await work();
    } catch (error) {
      setMessage(reason(error));
    } finally {
      running.current = false;
      setLoading(false);
    }
  };
  const load = (selected = workspace) =>
    run(async () => {
      const result = collectionSourcesReply.parse(
        await request(
          "collection-sources",
          selected ? { workspace: selected } : {},
        ),
      );
      if (result.workspace !== (selected || null))
        throw Error(
          "The server returned another workspace. Keep the current selection.",
        );
      setSources(result);
      setBook(undefined);
      setChoice("");
      setItem("");
      setMessage(result.message);
    });
  useEffect(() => {
    if (active && !sources && !running.current) void load("");
  }, [active]);
  const choose = (key: string) =>
    run(async () => {
      const selected = sources?.sources.find(
        (entry) => entry.stack + "/" + entry.instance === key,
      );
      setChoice(key);
      setBook(undefined);
      setItem("");
      setReceipt(undefined);
      if (!selected) return;
      const { workspace, stack, instance, expectedRevision } = selected;
      const result = collectionItemsReply.parse(
        await request("collection-items", {
          workspace,
          stack,
          instance,
          expectedRevision,
        }),
      );
      if (
        !same(result.selection, {
          workspace,
          stack,
          instance,
          expectedRevision,
        }) ||
        !same(result.source, selected.source)
      )
        throw Error(
          "The saved book changed. Refresh its sources before collecting.",
        );
      setBook(result);
      setInvitation(undefined);
      setInvitationError("");
      setMessage(
        result.pending
          ? "This book has an unresolved app operation. Reconcile it in Creator before collecting."
          : !result.visible
            ? "This visitor book is hidden. It has no eligible public contributions."
            : result.items.length
              ? "Choose an approved contribution. Guestbook will recheck public eligibility when collecting."
              : "No approved public contributions in this saved book.",
      );
      try {
        const invite = collectionInvitationReply.parse(
          await request("collection-invitation", { ...result.selection }),
        );
        if (
          !same(invite.selection, result.selection) ||
          !same(invite.source, result.source)
        )
          throw Error("The app returned another invitation source.");
        setInvitation(invite);
      } catch (error) {
        setInvitationError(reason(error));
      }
    });
  const changeInvitation = (operation: "enable" | "disable") =>
    run(async () => {
      if (!book) return;
      setInvitationError("");
      const result = collectionInvitationReply.parse(
        await request("collection-invitation-set", {
          ...book.selection,
          operation,
        }),
      );
      if (
        !same(result.selection, book.selection) ||
        !same(result.source, book.source)
      )
        throw Error("Linkarooie acknowledged another contribution source.");
      setInvitation(result);
      setMessage(result.message);
    });
  const feature = () =>
    run(async () => {
      if (!book || !item || uncertain) return;
      const submitted = {
        workspace: book.selection.workspace,
        source: book.source,
        item,
      };
      const unknown = (message: string): CollectionReceipt => ({
        ok: true,
        ...submitted,
        outcome: "unknown",
        message,
      });
      setMessage("Collecting this approved contribution…");
      try {
        const result = collectionReceipt.parse(
          await request("feature-resource", { ...book.selection, item }),
        );
        if (
          !same(result.source, submitted.source) ||
          result.workspace !== submitted.workspace ||
          result.item !== submitted.item
        )
          throw Error("The app acknowledged another reference.");
        setReceipt(result);
        setMessage(result.message);
      } catch (error) {
        const code =
          error instanceof Error && "code" in error ? error.code : undefined;
        const safe =
          typeof code === "string" &&
          [
            "INVALID",
            "FORBIDDEN",
            "CONFLICT",
            "SOURCE",
            "UNSUPPORTED",
            "UNAVAILABLE",
          ].includes(code);
        const result = safe
          ? { ...unknown(reason(error)), outcome: "refused" as const }
          : unknown(
              "The response could not be confirmed. This contribution may already be collected. Check its exact saved reference before continuing.",
            );
        setReceipt(result);
        setMessage(result.message);
      }
    });
  const check = () =>
    run(async () => {
      if (!receipt || !uncertain) return;
      const result = collectionReceipt.parse(
        await request("collection-check", {
          workspace: receipt.workspace,
          resource: receipt.source.resource,
          configuration: receipt.source.configuration,
          item: receipt.item,
        }),
      );
      if (
        !["unchanged", "unknown"].includes(result.outcome) ||
        !same(result.source, receipt.source) ||
        result.workspace !== receipt.workspace ||
        result.item !== receipt.item
      )
        throw Error(
          "The saved collection did not confirm this exact reference. Its result remains unknown.",
        );
      setReceipt(result);
      setMessage(result.message);
    });
  const disabled = busy || loading;
  return (
    <section
      className="ca-disclosure"
      hidden={!active}
      aria-label="Collect from a saved visitor book"
    >
      <h2>Collect from a saved visitor book</h2>
      <p>
        Choose a workspace and a saved book. This adds a source reference to the
        installation’s Linkarooie collection; it does not copy private media or
        grant moderation access.
      </p>
      <p role="status" aria-live="polite">
        {loading ? "Checking the selected apps… " : ""}
        {message}
      </p>
      <div className="ca-form">
        <label>
          Source workspace
          <select
            value={workspace}
            disabled={disabled || uncertain}
            onChange={(event) => {
              const selected = event.target.value;
              setWorkspace(selected);
              setSources((previous) =>
                previous
                  ? { ...previous, workspace: null, sources: [] }
                  : previous,
              );
              setBook(undefined);
              setChoice("");
              setItem("");
              setReceipt(undefined);
              setInvitation(undefined);
              setInvitationError("");
              void load(selected);
            }}
          >
            <option value="">Choose a workspace</option>
            {sources?.workspaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name} · {space.role}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || uncertain}
          onClick={() => void load()}
        >
          Refresh saved books
        </button>
        {sources?.supported && workspace && sources.workspace === workspace && (
          <>
            <label>
              Saved visitor book
              <select
                value={choice}
                disabled={disabled || uncertain}
                onChange={(event) => void choose(event.target.value)}
              >
                <option value="">Choose a saved book</option>
                {sources.sources.map((source) => (
                  <option
                    key={source.stack + "/" + source.instance}
                    value={source.stack + "/" + source.instance}
                  >
                    {source.stackName} · {source.label}
                    {source.shared ? " · shared" : ""}
                  </option>
                ))}
              </select>
            </label>
            {!sources.sources.length && (
              <p>
                No applied saved visitor books in this workspace. Save and apply
                one in Creator first.
              </p>
            )}
          </>
        )}
        {book && (
          <>
            <p>
              {book.title} · resource {book.source.resource} · configuration{" "}
              {book.source.configuration} · saved stack revision{" "}
              {book.selection.expectedRevision}
            </p>
            <label>
              Approved contribution
              <select
                value={item}
                disabled={disabled || uncertain}
                onChange={(event) => {
                  setItem(event.target.value);
                  setReceipt(undefined);
                }}
              >
                <option value="">Choose a contribution</option>
                {book.items.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.caption}
                    {entry.author ? " · " + entry.author : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                disabled ||
                uncertain ||
                !item ||
                !book.visible ||
                book.pending ||
                receipt?.outcome === "applied" ||
                receipt?.outcome === "unchanged"
              }
              onClick={() => void feature()}
            >
              Feature approved contribution
            </button>
          </>
        )}
        {book && (
          <div className="ca-invitation">
            <h3>Guestbook contributions</h3>
            <p>
              Guestbook owns the short postcard form, private review, approval
              and hiding. Linkarooie links to that real form only while the
              Guestbook says it accepts postcards. This is not a comment feed
              and never publishes a note automatically.
            </p>
            {invitationError ? (
              <>
                <p role="status">{invitationError}</p>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled || uncertain || !choice}
                  onClick={() => void choose(choice)}
                >
                  Check contribution state
                </button>
              </>
            ) : invitation ? (
              <>
                <p>
                  <strong>Current:</strong>{" "}
                  {invitationLabels[invitation.invitation.state] ??
                    invitationLabels.unavailable}
                  .{" "}
                  {invitation.configured && same(invitation.linked, book.source)
                    ? "This book is linked for contributions."
                    : invitation.configured
                      ? "A different Guestbook is linked for contributions."
                      : "No Guestbook is linked for contributions."}
                </p>
                {invitation.configured && same(invitation.linked, book.source) ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={disabled || uncertain}
                    onClick={() => void changeInvitation("disable")}
                  >
                    Stop inviting from this book
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      disabled ||
                      uncertain ||
                      !book.visible ||
                      book.pending
                    }
                    onClick={() => void changeInvitation("enable")}
                  >
                    Use this Guestbook for contributions
                  </button>
                )}
                {invitation.configured &&
                  !same(invitation.linked, book.source) && (
                    <p>
                      Choosing this book replaces the linked contribution
                      reference. It does not change either Guestbook’s records,
                      settings or visibility.
                    </p>
                  )}
                {!book.visible && (
                  <p>Publish this visitor book before inviting contributions.</p>
                )}
              </>
            ) : (
              <p>Checking the contribution state…</p>
            )}
            <p className="small">
              Review and approve notes in Guestbook. Featuring an approved note
              is still a separate choice under “Feature approved contribution”.
              Hiding it at the source removes it from both views.
            </p>
          </div>
        )}
        {receipt && (
          <p>
            Source reference: {receipt.source.resource} / c/
            {receipt.source.configuration} / {receipt.item}
            {receipt.card ? " · saved card " + receipt.card.id : ""} ·{" "}
            {receipt.outcome}
          </p>
        )}
        {uncertain && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void check()}
          >
            Check saved source reference
          </button>
        )}
      </div>
    </section>
  );
}
