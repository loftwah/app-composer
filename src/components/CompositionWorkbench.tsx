import { flushSync } from "react-dom";
import { builderHref } from "../lib/builder-context.mjs";
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  DEMO_KEY,
  demoOutcomes,
  HANDOFF_KEY,
  eligible,
  featured,
  images,
  initialBench,
  readBench,
  startingSpec,
  sourcePhoto,
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
  const view = sourcePhoto(item);
  return (
    <>
      <img
        src={view?.image ?? image.src}
        alt={image.alt}
        width="1200"
        height="900"
        draggable={false}
        decoding="async"
      />
      <span className="bench-photo-caption">
        {view?.title || item.caption || "Untitled postcard"}
      </span>
    </>
  );
}
// Reader-facing names for saved settings. Raw layout values and record IDs stay
// in the technical explanation, not in the normal history summary.
const layoutLabel = (layout: Presentation["layout"]) =>
  layout === "editorial" ? "Large images" : "Gallery grid";
const stateLabel = (status: string) =>
  status === "approved"
    ? "Available to add"
    : status === "deleted"
      ? "Deleted at the source"
      : "Hidden from the collection";
const postcardName = (items: DemoItem[], id: string | null) =>
  (id && items.find((item) => item.id === id)?.caption) || "Empty position";
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
        data-bench-item="heading"
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
            data-bench-item={item?.id ?? `empty-${slot}`}
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
                  : "Apps are disconnected"}
              </span>
            )}
            {place && (
              <button
                type="button"
                className="bench-place"
                onClick={() => place(slot)}
                disabled={!selected}
                aria-label={`Add postcard to position ${slot + 1}`}
              >
                Add here
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
        Your own links stay in place when you disconnect the apps.
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
      "Choose a postcard, then add it to your collection.",
    ),
    [peel, setPeel] = useState(false),
    [layer, setLayer] = useState("content"),
    [preview, setPreview] = useState<number | null>(null),
    [study, setStudy] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: string;
      pointerId: number;
      x: number;
      y: number;
      node: HTMLElement;
      moved: boolean;
    } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const outcomes = demoOutcomes(state);
  const item = state.items.find((item) => item.id === state.selected)!;
  const revision =
    state.revisions.find((revision) => revision.id === preview) ??
    state.revisions.at(-1);
  const transfer = (update: () => void) => {
    const bench = root.current;
    const before = new Map<string, DOMRect>();
    bench
      ?.querySelectorAll<HTMLElement>(".bench-published [data-bench-item]")
      .forEach((node) =>
        before.set(node.dataset.benchItem!, node.getBoundingClientRect()),
      );
    bench
      ?.getAnimations({ subtree: true })
      .forEach((animation) => animation.cancel());
    // Domain state commits in this event. Animation never receives its callback.
    flushSync(update);
    if (!bench || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    bench
      .querySelectorAll<HTMLElement>(".bench-published [data-bench-item]")
      .forEach((node) => {
        const id = node.dataset.benchItem!,
          after = node.getBoundingClientRect();
        const prior =
          before.get(id) ??
          bench
            .querySelector<HTMLElement>(
              `.bench-destination [data-bench-item="${id}"]`,
            )
            ?.getBoundingClientRect();
        const from =
          prior && after.width && after.height
            ? `translate(${prior.left - after.left}px,${prior.top - after.top}px) scale(${prior.width / after.width},${prior.height / after.height})`
            : "translateY(10px)";
        node.animate(
          [
            {
              transform: from,
              transformOrigin: "0 0",
              clipPath: prior ? "inset(0)" : "inset(100% 0 0 0)",
              opacity: 0.7,
            },
            {
              transform: "none",
              transformOrigin: "0 0",
              clipPath: "inset(0)",
              opacity: 1,
            },
          ],
          { duration: 360, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      });
  };
  const apply = (action: Action, text?: string) => {
    if (action.type === "publish" || action.type === "restore")
      transfer(() => dispatch(action));
    else dispatch(action);
    if (text) setMessage(text);
    else if (action.type !== "inspect" && action.type !== "select") setMessage("");
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
          "This browser cannot save your demo changes. You can still try the demo in this tab.",
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
        drawRoutes();
      }
    };
    const hide = () => {
      if (document.hidden) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) {
        cancel();
        root.current
          ?.getAnimations({ subtree: true })
          .forEach((animation) => animation.cancel());
      }
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      root.current
        ?.getAnimations({ subtree: true })
        .forEach((animation) => animation.cancel());
      observer.disconnect();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  function drawRoutes(point?: { x: number; y: number }, draggedID?: string) {
    const apparatus =
      root.current?.querySelector<HTMLElement>(".bench-apparatus");
    const svg = apparatus?.querySelector<SVGSVGElement>(".bench-wire-layer");
    if (!apparatus || !svg) return;
    const bounds = apparatus.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      `M ${a.x} ${a.y} C ${a.x + Math.min(120, Math.abs(b.x - a.x) / 2)} ${a.y}, ${b.x - Math.min(120, Math.abs(b.x - a.x) / 2)} ${b.y}, ${b.x} ${b.y}`;
    stateRef.current.draft.slots.forEach((id, slot) => {
      const path = svg.querySelector<SVGPathElement>(`[data-wire="${slot}"]`)!;
      const record = stateRef.current.items.find((record) => record.id === id);
      const source = apparatus.querySelector<HTMLElement>(
        `[data-postcard-id="${id}"]`,
      );
      const target = apparatus.querySelector<HTMLElement>(
        `[data-bench-slot="${slot}"]`,
      );
      if (
        !source ||
        !target ||
        !eligible(record) ||
        !stateRef.current.draft.connected
      ) {
        path.setAttribute("d", "");
        return;
      }
      const a = source.getBoundingClientRect(),
        b = target.getBoundingClientRect();
      path.setAttribute(
        "d",
        curve(
          { x: a.right - bounds.left, y: a.top + a.height / 2 - bounds.top },
          { x: b.left - bounds.left, y: b.top + b.height / 2 - bounds.top },
        ),
      );
    });
    const path = svg.querySelector<SVGPathElement>('[data-wire="drag"]')!;
    const source = draggedID
      ? apparatus.querySelector<HTMLElement>(
          `[data-postcard-id="${draggedID}"]`,
        )
      : null;
    if (
      point &&
      source &&
      drag.current &&
      eligible(stateRef.current.items.find((record) => record.id === draggedID))
    ) {
      const a = source.getBoundingClientRect();
      const dx = point.x - drag.current.x,
        dy = point.y - drag.current.y;
      path.setAttribute(
        "d",
        curve(
          {
            x: a.right - dx - bounds.left,
            y: a.top + a.height / 2 - dy - bounds.top,
          },
          { x: point.x - bounds.left, y: point.y - bounds.top },
        ),
      );
    } else path.setAttribute("d", "");
  }
  useLayoutEffect(() => {
    const current = drag.current;
    if (
      current &&
      !eligible(
        stateRef.current.items.find((record) => record.id === current.id),
      )
    ) {
      current.node.style.removeProperty("transform");
      current.node.classList.remove("bench-lifted");
      drag.current = null;
      root.current?.classList.remove("bench-dragging");
    }
    drawRoutes();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      root.current
        ?.querySelectorAll<SVGPathElement>(".bench-wire-layer path")
        .forEach((path) => {
          if (path.getAttribute("d")) {
            path.getAnimations().forEach((animation) => animation.cancel());
            path.animate(
              [
                { strokeWidth: 5, opacity: 0.45 },
                { strokeWidth: 2.5, opacity: 1 },
              ],
              { duration: 320, easing: "ease-out" },
            );
          }
        });
    const apparatus = root.current?.querySelector(".bench-apparatus");
    if (!apparatus) return;
    const observer = new ResizeObserver(() => drawRoutes());
    observer.observe(apparatus);
    apparatus
      .querySelectorAll(
        "[data-postcard-id],[data-bench-slot],.bench-peel-stack,.bench-collection",
      )
      .forEach((endpoint) => observer.observe(endpoint));
    const settled = () => drawRoutes();
    apparatus.addEventListener("transitionend", settled);
    return () => {
      observer.disconnect();
      apparatus.removeEventListener("transitionend", settled);
    };
  }, [
    state.draft.connected,
    state.draft.title,
    state.draft.layout,
    state.draft.slots.join(","),
    state.selected,
    peel,
    study,
    state.items
      .map((item) => `${item.status}:${item.caption}:${item.image}`)
      .join("|"),
  ]);
  function handoff() {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(startingSpec(state)));
      location.assign(
        builderHref(
          new URL(location.href),
          "/init?start=workbench#starting-point",
        ),
      );
    } catch {
      setMessage(
        "We couldn’t carry your settings to the next step. Allow session storage and try again. Your existing setup draft has not changed.",
      );
    }
  }
  const own = (value: string) => {
    setLayer(value);
    setPeel(true);
    dispatch({ type: "inspect" });
  };
  function finish(event: React.PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = current.moved
      ? document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-bench-slot]")
      : null;
    const displaced = current.node.style.transform;
    current.node.style.removeProperty("transform");
    if (
      current.moved &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      current.node.animate(
        [
          { transform: displaced },
          { transform: getComputedStyle(current.node).transform },
        ],
        { duration: 320, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    current.node.classList.remove("bench-lifted");
    root.current?.classList.remove("bench-dragging");
    drag.current = null;
    drawRoutes();
    if (current.moved) {
      if (
        target &&
        eligible(stateRef.current.items.find((item) => item.id === current.id))
      ) {
        apply(
          {
            type: "connect",
            slot: Number(target.dataset.benchSlot),
            id: current.id,
          },
          "Postcard added. Changes to the original will appear here too.",
        );
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
          target.animate(
            [
              { transform: "scale(.97)" },
              { transform: "scale(1.025)" },
              { transform: "scale(1)" },
            ],
            { duration: 350, easing: "cubic-bezier(.16,1,.3,1)" },
          );
      } else
        setMessage(
          "Drop the postcard into a collection space, or choose Add here.",
        );
    }
  }
  const selectedEligible = eligible(item);
  return (
    <div
      ref={root}
      className={`composition-workbench ${study ? "bench-study-inline" : ""} ${peel ? "bench-peeled" : ""}`}
      data-workbench="v1"
      data-ready={ready}
    >
      <div className="bench-toolbar">
        <p>
          <strong>Interactive demo</strong> · fictional postcards · changes stay
          in this browser
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Reset the demo and remove its saved versions from this browser? Your app setup draft will stay unchanged.",
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
        <svg className="bench-wire-layer" aria-hidden="true">
          <path data-wire="0" />
          <path data-wire="1" />
          <path data-wire="drag" />
        </svg>
        <section className="bench-source" aria-labelledby="bench-source-title">
          <div className="bench-app-name">
            <img
              src="/brand/apps/herethere-small-20261018.webp"
              alt=""
              width="44"
              height="44"
            />
            <h2 id="bench-source-title">Here / there</h2>
            <span>Original postcards</span>
          </div>
          <p className="bench-instruction">
            Choose a postcard, then select <strong>Add here</strong> in your
            collection. You can also drag a postcard into place. Change its
            caption to see the collection update.
          </p>
          <div className="bench-postcards">
            {state.items.map((record) => (
              <button
                key={record.id}
                type="button"
                aria-pressed={record.id === state.selected}
                data-postcard-id={record.id}
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
                  node
                    .getAnimations()
                    .forEach((animation) => animation.cancel());
                  node.setPointerCapture(event.pointerId);
                  drag.current = {
                    id: record.id,
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    node,
                    moved: false,
                  };
                }}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current || current.pointerId !== event.pointerId) return;
                  const x = event.clientX - current.x,
                    y = event.clientY - current.y;
                  if (Math.hypot(x, y) > 6) {
                    current.moved = true;
                    current.node.classList.add("bench-lifted");
                    root.current?.classList.add("bench-dragging");
                    current.node.style.transform = `translate(${x}px,${y}px) rotate(${Math.max(-8, Math.min(8, x / 30))}deg)`;
                    drawRoutes(
                      { x: event.clientX, y: event.clientY },
                      current.id,
                    );
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
                    drawRoutes();
                  }
                }}
              >
                <Photo item={record} />
                <span className="bench-record-state">
                  {stateLabel(record.status)}
                </span>
              </button>
            ))}
          </div>
        </section>
        <div className="bench-route-spacer" aria-hidden="true" />
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
            <span>Your draft</span>
          </div>
          <div className="bench-peel-stack">
            <div
              className={`bench-sheet bench-sheet-presentation ${layer === "presentation" ? "bench-sheet-selected" : ""}`}
            >
              <div className="bench-sheet-label" aria-hidden={!peel}>
                Collection layout
              </div>
              <Collection
                state={state}
                presentation={state.draft}
                place={(slot) =>
                  apply(
                    { type: "connect", slot },
                    "Postcard added. Changes to the original will appear here too.",
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
            </div>
            <div
              className={`bench-sheet bench-sheet-configuration ${layer === "configuration" ? "bench-sheet-selected" : ""}`}
              inert={!peel}
            >
              <button
                type="button"
                className="bench-sheet-label"
                onClick={() => own("configuration")}
              >
                Page settings
              </button>
              <strong>{state.draft.title || "Our small universe"}</strong>
              <span>{layoutLabel(state.draft.layout)} · page title</span>
            </div>
            <div
              className={`bench-sheet bench-sheet-content ${layer === "content" ? "bench-sheet-selected" : ""}`}
              inert={!peel}
            >
              <button
                type="button"
                className="bench-sheet-label"
                onClick={() => own("content")}
              >
                Photos and captions
              </button>
              <div className="bench-sheet-record">
                <img
                  src={images[item.image].src}
                  alt={images[item.image].alt}
                  width="1200"
                  height="900"
                />
                <div>
                  <strong>{item.caption || "Untitled postcard"}</strong>
                  <span>
                    {stateLabel(item.status)} · record revision {item.revision}
                  </span>
                  <code>{item.id}</code>
                </div>
              </div>
            </div>
            <div
              className={`bench-sheet bench-sheet-source ${layer === "source" ? "bench-sheet-selected" : ""}`}
              inert={!peel}
            >
              <button
                type="button"
                className="bench-sheet-label"
                onClick={() => own("source")}
              >
                App source code
              </button>
              {sources.map((source) => (
                <a
                  key={source.id}
                  href={`${source.repository}/tree/${source.commit}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.name} <code>{source.commit.slice(0, 10)}</code> ↗
                </a>
              ))}
            </div>
          </div>
          <div className="bench-connection-actions">
            <button
              type="button"
              onClick={() =>
                apply(
                  { type: "disconnect" },
                  "Apps disconnected. Your original postcards and your own link are still there.",
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
                if (!peel) dispatch({ type: "inspect" });
                setMessage(
                  peel
                    ? "Back to your collection. Your changes are still here."
                    : "See what each part controls: the collection, its settings, the postcards and the app code.",
                );
              }}
            >
              {peel ? "Close explanation" : "See how it works"}
            </button>
          </div>
        </section>
        <div className="bench-source-editor">
          <div className="bench-editor-heading">
            <strong>Edit the original postcard</strong>
            <button type="button" onClick={() => own("content")}>
              Where is this stored?
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
            Postcard image
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
                  ? "Postcard hidden. It no longer appears in the draft or saved previews."
                  : "Postcard available again. Choose Add here to put it back in your draft.",
              )
            }
          >
            {selectedEligible ? "Hide postcard" : "Make postcard available"}
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="bench-status">
        {message}
      </p>
      {peel && (
        <section className="bench-ownership" aria-label="How the collection fits together">
          <div
            className="bench-layer-tabs"
            role="group"
            aria-label="Choose a part to explain"
          >
            {[
              ["presentation", "Collection layout"],
              ["configuration", "Page settings"],
              ["content", "Photos and captions"],
              ["source", "App source code"],
            ].map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={layer === id}
                onClick={() => {
                  setLayer(id);
                  dispatch({ type: "inspect" });
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="bench-layer-detail">
            {layer === "presentation" && (
              <>
                <h3>Arrange the postcards without moving the originals.</h3>
                <p>
                  The collection remembers which postcards you selected and
                  where they appear. Photos and captions stay in Here / there,
                  so changes to an original appear wherever it is shown.
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
                    <option value="editorial">Large images</option>
                  </select>
                </label>
              </>
            )}
            {layer === "configuration" && (
              <>
                <h3>Give your collection its own identity.</h3>
                <label>
                  Collection title
                  <input
                    value={state.draft.title}
                    maxLength={80}
                    onChange={(event) =>
                      apply({ type: "title", value: event.target.value })
                    }
                  />
                </label>
                <p>
                  Change the collection title without changing the postcards in
                  Here / there.
                </p>
              </>
            )}
            {layer === "content" && (
              <>
                <h3>The original stays in Here / there.</h3>
                <p>
                  Here / there holds each postcard’s photo, caption and
                  visibility. Saved collection versions use the latest
                  postcard. Restoring an arrangement won’t bring back a hidden
                  postcard or remove a newer one.
                </p>
                <p>
                  <strong>{item.caption || "Untitled postcard"}</strong>
                </p>
                <p className="bench-record-meta">
                  {stateLabel(item.status)} · record revision {item.revision} ·{" "}
                  <code>{item.id}</code>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    apply(
                      { type: "later" },
                      "Example postcard added. Restoring an older collection will keep this postcard.",
                    )
                  }
                  disabled={state.items.length === 3}
                >
                  Add another example postcard
                </button>
              </>
            )}
            {layer === "source" && (
              <>
                <h3>Each app has its own code.</h3>
                <p>
                  Here / there and Linkarooie are maintained in separate
                  repositories. These links show the exact app versions included
                  in this App Composer build. Changes in this demo stay in your
                  browser.
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
          <h2 id="bench-revisions-title">Save a version of your collection</h2>
          <p>
            Save your arrangement, try another, then compare them. Restoring a
            version brings back its layout, settings and postcard selection.
            Photos, captions and visibility always follow the latest originals.
          </p>
          <div className="bench-save">
            <button
              className="button"
              type="button"
              onClick={() => {
                apply(
                  { type: "publish" },
                  "Demo version saved in this browser.",
                );
                setPreview(null);
              }}
            >
              Save demo version
            </button>
            <p className="bench-save-note">
              Demo versions are saved in this browser. Saving here does not
              publish a website.
            </p>
          </div>
          <div className="bench-timeline">
            {state.revisions.map((saved) => (
              <button
                type="button"
                key={saved.id}
                aria-pressed={revision?.id === saved.id}
                onClick={() => {
                  transfer(() => setPreview(saved.id));
                  setMessage(
                    `Viewing version ${saved.id}. Your draft has not changed.`,
                  );
                }}
              >
                <strong>Version {saved.id}</strong>
                <span>
                  {saved.presentation.title} ·{" "}
                  {layoutLabel(saved.presentation.layout)} ·{" "}
                  {saved.presentation.slots
                    .map((id) => postcardName(state.items, id))
                    .join(" / ")}{" "}
                  ·{" "}
                  {saved.presentation.connected
                    ? "Apps connected"
                    : "Apps are disconnected"}
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
                    `Version ${revision.id} restored as a new saved version. Postcards keep their latest content and visibility.`,
                  );
                  setPreview(null);
                }}
              >
                Restore version {revision.id}
              </button>
              {preview !== null && (
                <button
                  type="button"
                  onClick={() => transfer(() => setPreview(null))}
                >
                  Back to latest saved version
                </button>
              )}
            </div>
          )}
        </div>
        <div className="bench-published">
          <h3>
            {revision
              ? `Saved version ${revision.id}${preview !== null ? " · Preview" : ""}`
              : "No saved versions yet"}
          </h3>
          {revision ? (
            <Collection
              state={state}
              presentation={revision.presentation}
              published
            />
          ) : (
            <p>
              Add a postcard to your draft, then choose{" "}
              <strong>Save demo version</strong> to see it here.
            </p>
          )}
        </div>
      </section>
      <footer className="bench-finish">
        <div>
          <h2>Your collection so far</h2>
          <p className="bench-outcome-scope">Current draft</p>
          <dl
            className="bench-outcomes"
            aria-label="Your collection so far in this demo"
          >
            <div>
              <dt>Available postcards</dt>
              <dd>{outcomes.approvedPostcards}</dd>
            </div>
            <div>
              <dt>Postcards in your collection</dt>
              <dd>{outcomes.connectedReferences}</dd>
            </div>
            <div>
              <dt>Saved versions</dt>
              <dd>{outcomes.savedRevisions}</dd>
            </div>
          </dl>
          <p>
            {[
              "connect",
              "edit",
              "hide",
              "restore",
              "disconnect",
              "inspect",
              "publish",
            ].every((name) => state.milestones.includes(name))
              ? "You’ve seen how the apps connect, how changes carry through and how to restore an arrangement."
              : "Try changing a caption, hiding a postcard or saving another arrangement."}
          </p>
          <p className="bench-footnote">
            This browser keeps your latest 24 demo versions.
          </p>
        </div>
        <div className="bench-handoff">
          <button type="button" className="button" onClick={handoff}>
            Use these settings →
          </button>
          <p className="bench-handoff-note">
            Carry your collection title and layout into app setup. Example
            postcards and saved demo versions stay here.
          </p>
        </div>
      </footer>
      {ready && new URLSearchParams(location.search).has("studies") && (
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
