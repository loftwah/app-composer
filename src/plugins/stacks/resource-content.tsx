import { useEffect, useRef, useState } from "react";
import { call, type Stack } from "./api";
import type { ResourceBook, ResourceContentChange } from "./protocol";

type Reply = Awaited<ReturnType<typeof call>>;
export type ResourceContentAction = (
  instance: string,
  change: ResourceContentChange | null | "retry",
  accept: (data: Reply) => void,
) => Promise<void>;

function PrivatePostcard({
  stack,
  book,
  item,
}: {
  stack: Stack;
  book: ResourceBook;
  item: ResourceBook["items"][number];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    setState("loading");
    void (async () => {
      try {
        const { media } = await call("resourceMedia", {
          stack: stack.id,
          instance: book.instance,
          expectedRevision: stack.revision,
          item: item.id,
        });
        if (
          !media ||
          media.instance !== book.instance ||
          media.resource !== book.resource ||
          media.item !== item.id
        )
          throw Error("The preview belongs to another visitor book.");
        const bytes = Uint8Array.from(atob(media.png), (char) =>
          char.charCodeAt(0),
        );
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        if (active && canvas.current) {
          canvas.current.width = bitmap.width;
          canvas.current.height = bitmap.height;
          canvas.current.getContext("2d")?.drawImage(bitmap, 0, 0);
          setState("ready");
        }
        bitmap.close();
      } catch {
        if (active) setState("failed");
      }
    })();
    return () => {
      active = false;
    };
  }, [
    stack.id,
    stack.revision,
    book.resource,
    book.instance,
    item.id,
    item.revision,
  ]);
  return (
    <div>
      {state === "loading" && <p role="status">Loading private postcard…</p>}
      {state === "failed" && (
        <p role="status">
          Private preview unavailable. Refresh the content to check it.
        </p>
      )}
      <canvas
        ref={canvas}
        hidden={state !== "ready"}
        className="ca-photo"
        role="img"
        aria-label={item.caption || "Private postcard preview"}
      />
    </div>
  );
}

export function ResourceContent({
  stack,
  instance,
  busy,
  uncertain,
  onAction,
  onClose,
}: {
  stack: Stack;
  instance: string;
  busy: boolean;
  uncertain: boolean;
  onAction: ResourceContentAction;
  onClose: () => void;
}) {
  const [book, setBook] = useState<ResourceBook>();
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setBook(undefined);
    setFailure("");
    setPreviews([]);
    void call("resourceContent", {
      stack: stack.id,
      instance,
      expectedRevision: stack.revision,
    })
      .then((data) => {
        if (!data.book || data.book.instance !== instance)
          throw Error(
            "The app did not confirm the selected saved visitor book.",
          );
        if (active) setBook(data.book);
      })
      .catch((cause: unknown) => {
        if (active)
          setFailure(
            cause instanceof Error
              ? cause.message
              : "Visitor book content is unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, [stack.id, stack.revision, instance, refresh]);

  const act = (change: ResourceContentChange | null | "retry") =>
    onAction(instance, change, (data) => {
      setBook(data.book);
      setPreviews([]);
      setFailure(
        data.book
          ? ""
          : "The operation reply arrived, but the content could not be loaded. Check the app operation before making another change.",
      );
    });
  const blocked =
    busy || uncertain || !book || book.pending || Boolean(failure);
  const moderate = (
    item: ResourceBook["items"][number],
    status: "approved" | "hidden" | "deleted",
  ) => {
    if (!book || blocked) return;
    if (
      status === "deleted" &&
      !confirm(
        "Delete this postcard and revoke its media? This cannot be undone.",
      )
    )
      return;
    void act({
      command: "moderate",
      operationId: crypto.randomUUID(),
      resource: book.resource,
      expectedVersion: book.version,
      item: item.id,
      itemRevision: item.revision,
      status,
    });
  };
  const control = (visible: boolean, paused: boolean) => {
    if (!book || blocked) return;
    void act({
      command: "control",
      operationId: crypto.randomUUID(),
      resource: book.resource,
      expectedVersion: book.version,
      visible,
      paused,
    });
  };
  const items = book?.items.toSorted(
    (a, b) =>
      Number(b.status === "pending") - Number(a.status === "pending") ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  );

  return (
    <section
      className="ca-owned-content"
      aria-label="Saved visitor book content"
    >
      <div className="ca-heading">
        <div>
          <h2>{book?.title || "Saved visitor book content"}</h2>
          <p>
            Review contributions to this saved visitor book. Approvals and
            controls affect every use of these records. Stack edits stay in the editor.
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Close content
        </button>
      </div>
      {book?.shared && (
        <p>
          This book is shared. Moderation and controls affect every use of these
          records.
        </p>
      )}
      {book && (
        <p>
          Visitor book {book.resource.slice(0, 8)} · app version {book.version}{" "}
          · {book.visible ? "Public book" : "Book hidden"} ·{" "}
          {book.paused
            ? "Submissions paused"
            : "Submissions follow the app settings"}
        </p>
      )}
      {!book && !failure && (
        <p role="status">Loading this saved visitor book…</p>
      )}
      {failure && <p role="alert">{failure}</p>}
      {(uncertain || book?.pending) && (
        <p role="status">
          A previous app operation is not confirmed. Check it before changing
          this book. Your local stack edits are still here.
        </p>
      )}
      <div className="ca-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Refresh content
        </button>
        <button type="button" disabled={busy} onClick={() => void act(null)}>
          Check content operation
        </button>
        {(uncertain || book?.pending) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("retry")}
          >
            Check and retry recorded change
          </button>
        )}
        {book && (
          <a href={book.path} target="_blank" rel="noopener noreferrer">
            Open visitor book
          </a>
        )}
      </div>
      {book && (
        <>
          <div className="ca-actions ca-content-controls">
            <button
              type="button"
              disabled={blocked}
              onClick={() => control(book.visible, !book.paused)}
            >
              {book.paused
                ? "Resume guest submissions"
                : "Pause guest submissions"}
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => control(!book.visible, book.paused)}
            >
              {book.visible ? "Hide visitor book" : "Make visitor book public"}
            </button>
          </div>
          <h3>Contributions ({items?.length ?? 0})</h3>
          {!items?.length && (
            <p>
              No contributions yet. Guest postcards appear here for review
              before publication.
            </p>
          )}
          <div className="ca-contributions">
            {items?.map((item) => (
              <article key={item.id}>
                <div>
                  {previews.includes(item.id) ? (
                    <PrivatePostcard stack={stack} book={book} item={item} />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPreviews((list) => [...list, item.id])}
                    >
                      View private postcard
                    </button>
                  )}
                </div>
                <div>
                  <p>
                    <span className="ca-state">{item.status}</span>
                    {item.synthetic ? " · Fictional demonstration" : ""}
                  </p>
                  <h4>{item.caption}</h4>
                  <p>{item.author || "Anonymous visitor"}</p>
                  <div className="ca-actions">
                    <button
                      type="button"
                      disabled={blocked || item.status === "approved"}
                      onClick={() => moderate(item, "approved")}
                    >
                      Approve postcard
                    </button>
                    <button
                      type="button"
                      disabled={blocked || item.status === "hidden"}
                      onClick={() => moderate(item, "hidden")}
                    >
                      Hide postcard
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => moderate(item, "deleted")}
                    >
                      Delete postcard
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
