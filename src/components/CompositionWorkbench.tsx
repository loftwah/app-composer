import { useEffect, useReducer, useRef, useState } from "react";
import {
  DEMO_KEY,
  HANDOFF_KEY,
  eligible,
  featured,
  images,
  initialBench,
  readBench,
  startingSpec,
  transition,
  type Action,
  type BenchState,
  type DemoItem,
  type Presentation,
} from "../lib/workbench";
import "../styles/workbench.css";

interface Source {
  id: string;
  name: string;
  repository: string;
  commit: string;
}
function Photo({ item }: { item: DemoItem }) {
  const image = images[item.image];
  return (
    <>
      <img
        src={image.src}
        alt={image.alt}
        width="1200"
        height="900"
        draggable={false}
        decoding="async"
      />
      <span className="bench-photo-caption">
        {item.caption || "Untitled postcard"}
      </span>
    </>
  );
}
function Collection({
  state,
  presentation,
  place,
  selected,
  published = false,
  inspect,
}: {
  state: BenchState;
  presentation: Presentation;
  place?: (slot: number) => void;
  selected?: boolean;
  published?: boolean;
  inspect?: (id?: string) => void;
}) {
  const cards = featured(state, presentation);
  return (
    <div className={`bench-collection bench-layout-${presentation.layout}`}>
      <button
        type="button"
        className="bench-collection-title"
        onClick={() => inspect?.()}
        disabled={!inspect}
      >
        {presentation.title || "Our small universe"}
      </button>
      <p className="bench-app-intro">Small discoveries. Good company.</p>
      <div className="bench-slots">
        {cards.map((item, slot) => (
          <div
            key={slot}
            data-bench-slot={published ? undefined : slot}
            className={`bench-slot ${selected && !published ? "bench-slot-ready" : ""} ${item ? "bench-slot-filled" : ""}`}
          >
            {item ? (
              <button
                type="button"
                className="bench-feature"
                onClick={() => inspect?.(item.id)}
                disabled={!inspect}
              >
                <Photo item={item} />
              </button>
            ) : (
              <span className="bench-slot-empty">
                {presentation.connected
                  ? `Postcard ${slot + 1}`
                  : "Apps disconnected"}
              </span>
            )}
            {place && (
              <button
                type="button"
                className="bench-place"
                onClick={() => place(slot)}
                disabled={!selected}
              >
                Place here<span className="sr-only"> in slot {slot + 1}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <a
        className="bench-own-link"
        href="https://example.com"
        target="_blank"
        rel="noreferrer"
      >
        Moon atlas <span>example.com ↗</span>
      </a>
      <p className="bench-footnote">
        Linkarooie’s own link stays when the apps disconnect.
      </p>
    </div>
  );
}
export default function CompositionWorkbench({
  sources,
}: {
  sources: Source[];
}) {
  const [state, dispatch] = useReducer(
    (
      current: BenchState,
      action: Action | { type: "load"; state: BenchState },
    ) => (action.type === "load" ? action.state : transition(current, action)),
    undefined,
    initialBench,
  );
  const [ready, setReady] = useState(false),
    [message, setMessage] = useState(
      "Choose a postcard. Place it in the collection.",
    ),
    [peel, setPeel] = useState(false),
    [layer, setLayer] = useState("content"),
    [preview, setPreview] = useState<number | null>(null),
    [study, setStudy] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      node: HTMLElement;
      moved: boolean;
    } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const item = state.items.find((item) => item.id === state.selected)!;
  const revision =
    state.revisions.find((revision) => revision.id === preview) ??
    state.revisions.at(-1);
  const apply = (action: Action, text?: string) => {
    dispatch(action);
    if (text) setMessage(text);
  };
  useEffect(() => {
    try {
      dispatch({
        type: "load",
        state: readBench(localStorage.getItem(DEMO_KEY)),
      });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(state));
      } catch {
        setMessage(
          "This browser cannot save the demo. Keep exploring in this tab.",
        );
      }
    }
  }, [state, ready]);
  useEffect(() => {
    const cancel = () => {
      const current = drag.current;
      if (current) {
        current.node.style.removeProperty("transform");
        current.node.classList.remove("bench-lifted");
        drag.current = null;
        root.current?.classList.remove("bench-dragging");
      }
    };
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  function handoff() {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(startingSpec(state)));
      location.assign("/init?start=workbench#starting-point");
    } catch {
      setMessage(
        "The browser could not prepare the handoff. Allow session storage and try again; your Init draft is unchanged.",
      );
    }
  }
  const own = (value: string) => {
    setLayer(value);
    setPeel(true);
  };
  function finish(event: React.PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current) return;
    current.node.style.removeProperty("transform");
    current.node.classList.remove("bench-lifted");
    root.current?.classList.remove("bench-dragging");
    drag.current = null;
    if (current.moved) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-bench-slot]");
      if (
        target &&
        eligible(stateRef.current.items.find((item) => item.id === current.id))
      ) {
        apply(
          { type: "connect", slot: Number(target.dataset.benchSlot) },
          "Connected. The collection now reads this source record.",
        );
      } else
        setMessage(
          "That is not an eligible collection slot. The postcard returned to its source.",
        );
    }
  }
  const selectedEligible = eligible(item);
  return (
    <div
      ref={root}
      className={`composition-workbench ${study ? "bench-study-inline" : ""} ${peel ? "bench-peeled" : ""}`}
      data-workbench="v1" data-ready={ready}
    >
      <div className="bench-toolbar">
        <p>
          <strong>Yours to try.</strong> Fictional records · saved only in this
          browser
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Reset only this fictional workbench? Your saved Init draft stays intact.",
              )
            ) {
              localStorage.removeItem(DEMO_KEY);
              location.reload();
            }
          }}
        >
          Reset demo
        </button>
      </div>
      <div className="bench-apparatus">
        <section className="bench-source" aria-labelledby="bench-source-title">
          <div className="bench-app-name">
            <img
              src="/brand/apps/herethere-small-20261018.webp"
              alt=""
              width="44"
              height="44"
            />
            <h2 id="bench-source-title">Here / there</h2>
            <span>Source app</span>
          </div>
          <p className="bench-instruction">
            Pick up a postcard, or select one and tap{" "}
            <strong>Place here</strong>.
          </p>
          <div className="bench-postcards">
            {state.items.map((record) => (
              <button
                key={record.id}
                type="button"
                aria-pressed={record.id === state.selected}
                className={`bench-postcard ${record.status !== "approved" ? "bench-postcard-hidden" : ""}`}
                onClick={() => apply({ type: "select", id: record.id })}
                onPointerDown={(event) => {
                  if (
                    event.button !== 0 ||
                    event.pointerType === "touch" ||
                    !eligible(record)
                  )
                    return;
                  dispatch({ type: "select", id: record.id });
                  const node = event.currentTarget;
                  node.setPointerCapture(event.pointerId);
                  drag.current = {
                    id: record.id,
                    x: event.clientX,
                    y: event.clientY,
                    node,
                    moved: false,
                  };
                }}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current) return;
                  const x = event.clientX - current.x,
                    y = event.clientY - current.y;
                  if (Math.hypot(x, y) > 6) {
                    current.moved = true;
                    current.node.classList.add("bench-lifted");
                    root.current?.classList.add("bench-dragging");
                    current.node.style.transform = `translate(${x}px,${y}px) rotate(${Math.max(-8, Math.min(8, x / 30))}deg)`;
                  }
                }}
                onPointerUp={finish}
                onPointerCancel={() => {
                  const current = drag.current;
                  if (current) {
                    current.node.style.removeProperty("transform");
                    current.node.classList.remove("bench-lifted");
                    drag.current = null;
                    root.current?.classList.remove("bench-dragging");
                  }
                }}
              >
                <Photo item={record} />
                <span className="bench-record-state">
                  {record.status === "approved"
                    ? "Approved · public"
                    : "Hidden · owner inspection"}
                </span>
              </button>
            ))}
          </div>
          <div className="bench-source-editor">
            <div className="bench-editor-heading">
              <strong>Edit source postcard</strong>
              <button type="button" onClick={() => own("content")}>
                Who owns this?
              </button>
            </div>
            <code>
              {item.id} · revision {item.revision}
            </code>
            <label>
              Caption
              <input
                maxLength={160}
                value={item.caption}
                onChange={(event) =>
                  apply({ type: "caption", value: event.target.value })
                }
              />
            </label>
            <label>
              Fictional image
              <select
                value={item.image}
                onChange={(event) =>
                  apply({ type: "image", value: Number(event.target.value) })
                }
              >
                <option value={0}>Ring market</option>
                <option value={1}>Moon lighthouse</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                apply(
                  { type: "visibility" },
                  selectedEligible
                    ? "Hidden at the source. Public representations have withdrawn."
                    : "Approved again. Select a slot to reconnect this postcard.",
                )
              }
            >
              {selectedEligible
                ? "Hide source postcard"
                : "Restore approved visibility"}
            </button>
          </div>
        </section>
        <div
          className={`bench-route ${state.draft.connected ? "" : "bench-route-off"}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 300" preserveAspectRatio="none">
            <path d="M 0 90 C 95 90 5 210 100 210" />
            <circle cx="50" cy="150" r="7" />
          </svg>
          <span>
            {state.draft.connected ? "Live reference" : "Independent"}
          </span>
        </div>
        <section
          className="bench-destination"
          aria-labelledby="bench-destination-title"
        >
          <div className="bench-app-name">
            <img
              src="/brand/apps/linkarooie-small-20261018.webp"
              alt=""
              width="44"
              height="44"
            />
            <h2 id="bench-destination-title">Linkarooie</h2>
            <span>Draft view</span>
          </div>
          <Collection
            state={state}
            presentation={state.draft}
            place={(slot) =>
              apply(
                { type: "connect", slot },
                "Placed. Caption and visibility follow the source, including future edits.",
              )
            }
            selected={selectedEligible}
            inspect={(id) => {
              if (id) {
                dispatch({ type: "select", id });
                own("content");
              } else own("configuration");
            }}
          />
          <div className="bench-connection-actions">
            <button
              type="button"
              onClick={() =>
                apply(
                  { type: "disconnect" },
                  "Disconnected. The source postcards and Linkarooie’s own link are intact.",
                )
              }
              disabled={!state.draft.connected}
            >
              Disconnect apps
            </button>
            <button
              type="button"
              onClick={() => {
                setPeel(!peel);
                setMessage(
                  peel
                    ? "Layers reassembled. Your selection and edits are retained."
                    : "Four owners, one working composition. Select a layer to inspect it.",
                );
              }}
            >
              {peel ? "Reassemble layers" : "Peel ownership layers"}
            </button>
          </div>
        </section>
      </div>
      <p role="status" aria-live="polite" className="bench-status">
        {message}
      </p>
      {peel && (
        <section className="bench-ownership" aria-label="Ownership layers">
          <div
            className="bench-layer-tabs"
            role="group"
            aria-label="Inspect ownership"
          >
            {[
              ["presentation", "Composer presentation"],
              ["configuration", "Instance configuration"],
              ["content", "App records & media"],
              ["source", "Pinned app source"],
            ].map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={layer === id}
                onClick={() => setLayer(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="bench-layer-detail">
            {layer === "presentation" && (
              <>
                <h3>Composer arranges the connections.</h3>
                <p>
                  Slots store source item IDs. They do not copy the photo or
                  caption. Demo revisions save this arrangement and these
                  settings.
                </p>
                <label>
                  Collection layout
                  <select
                    value={state.draft.layout}
                    onChange={(event) =>
                      apply({
                        type: "layout",
                        value: event.target.value as "grid" | "editorial",
                      })
                    }
                  >
                    <option value="grid">Gallery grid</option>
                    <option value="editorial">Larger editorial images</option>
                  </select>
                </label>
              </>
            )}
            {layer === "configuration" && (
              <>
                <h3>The heading is an instance setting.</h3>
                <label>
                  Linkarooie title
                  <input
                    value={state.draft.title}
                    maxLength={80}
                    onChange={(event) =>
                      apply({ type: "title", value: event.target.value })
                    }
                  />
                </label>
                <p>
                  Changing this supported title leaves Guestbook’s records
                  untouched.
                </p>
              </>
            )}
            {layer === "content" && (
              <>
                <h3>This photograph belongs to Guestbook.</h3>
                <p>
                  <code>{item.id}</code> · {item.status} · record revision{" "}
                  {item.revision}
                </p>
                <p>{item.caption}</p>
                <p>
                  The image and caption are current source data. Presentation
                  history cannot undo moderation or erase later records.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    apply(
                      { type: "later" },
                      "Later source record added. Preview or restore an older presentation: this record remains.",
                    )
                  }
                  disabled={state.items.length === 3}
                >
                  Add a later fictional record
                </button>
              </>
            )}
            {layer === "source" && (
              <>
                <h3>Separate source. Exact revisions.</h3>
                <p>
                  These are the independent applications mounted by this
                  Composer build. Exploring this local specimen does not write
                  to them.
                </p>
                {sources.map((source) => (
                  <p key={source.id}>
                    <a
                      href={`${source.repository}/tree/${source.commit}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.name} ↗
                    </a>
                    <br />
                    <code>{source.commit}</code>
                  </p>
                ))}
              </>
            )}
          </div>
        </section>
      )}
      <section
        className="bench-revisions"
        aria-labelledby="bench-revisions-title"
      >
        <div className="bench-revision-controls">
          <h2 id="bench-revisions-title">
            A draft. A published view. Your history.
          </h2>
          <p>
            Publish saves the arrangement on this device. Source records always
            stay current. This does not deploy to Cloudflare.
          </p>
          <button
            className="button"
            type="button"
            onClick={() => {
              apply(
                { type: "publish" },
                "Demo revision saved on this device. No cloud deployment occurred.",
              );
              setPreview(null);
            }}
          >
            Publish demo revision
          </button>
          <div className="bench-timeline">
            {state.revisions.map((saved) => (
              <button
                type="button"
                key={saved.id}
                aria-pressed={revision?.id === saved.id}
                onClick={() => {
                  setPreview(saved.id);
                  setMessage(
                    `Previewing revision ${saved.id}. The draft is unchanged.`,
                  );
                }}
              >
                <strong>r{saved.id}</strong>
                <span>
                  {saved.presentation.title} ·{" "}
                  {saved.presentation.slots.filter(Boolean).length} slots ·{" "}
                  {saved.presentation.connected ? "connected" : "disconnected"}
                </span>
              </button>
            ))}
          </div>
          {revision && (
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  apply(
                    { type: "restore", revision: revision.id },
                    `Restored presentation r${revision.id} as a new revision. Current source records and visibility are retained.`,
                  );
                  setPreview(null);
                }}
              >
                Restore r{revision.id} as new revision
              </button>
              {preview !== null && (
                <button type="button" onClick={() => setPreview(null)}>
                  Return to latest published
                </button>
              )}
            </div>
          )}
        </div>
        <div className="bench-published">
          <h3>
            {revision
              ? `Published demo · r${revision.id}${preview !== null ? " · preview" : ""}`
              : "Nothing published yet"}
          </h3>
          {revision ? (
            <Collection
              state={state}
              presentation={revision.presentation}
              published
            />
          ) : (
            <p>
              Your draft is live above. Connect a postcard, then publish your
              first local revision here.
            </p>
          )}
        </div>
      </section>
      <footer className="bench-finish">
        <div>
          <h2>Keep the experiment going.</h2>
          <p>
            {state.milestones.length >= 6
              ? "You have connected, changed and inspected your own local composition."
              : `${state.milestones.length} local discoveries saved. Try editing, hiding and disconnecting, then publish three arrangements.`}
          </p>
          <p className="bench-footnote">
            Init carries supported appearance and configuration. Fictional demo
            records and sandbox history stay here.
          </p>
        </div>
        <button type="button" className="button" onClick={handoff}>
          Use this starting point →
        </button>
      </footer>
      {typeof window !== "undefined" &&
        new URLSearchParams(location.search).has("studies") && (
          <details className="bench-studies">
            <summary>Composition studies</summary>
            <p>
              Assembly bench puts source and result across a visible connection.
              Inline proof places them in one reading column. Both operate the
              same records.
            </p>
            <button type="button" onClick={() => setStudy(!study)}>
              {study ? "Choose assembly bench" : "Try inline proof study"}
            </button>
          </details>
        )}
    </div>
  );
}
