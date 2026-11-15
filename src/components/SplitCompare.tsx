import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "../styles/split-compare.css";

interface Props {
  before: ReactNode;
  after: ReactNode;
  /** Left/before pane name, announced with the percentage. */
  beforeLabel: string;
  /** Right/after pane name. */
  afterLabel: string;
  label: string;
  initial?: number;
  caption?: string;
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** A before/after wipe whose only control is a native range input. The visual
 * panes are presentational copies; the caption and the range's value text carry
 * the meaning for assistive technology. Nothing animates, so reduced motion
 * needs no special path. */
export function SplitCompare({
  before,
  after,
  beforeLabel,
  afterLabel,
  label,
  initial = 50,
  caption,
}: Props) {
  const [position, setPosition] = useState(clamp(initial));
  const frame = useRef<HTMLDivElement>(null);
  const helpId = useId();
  // The split point is a CSS custom property rather than a style attribute.
  // Composer's production CSP refuses inline styles, and the stylesheet already
  // defaults --split to 50%, so the server-rendered markup needs no attribute.
  useEffect(() => {
    frame.current?.style.setProperty("--split", `${position}%`);
  }, [position]);
  function moveTo(clientX: number) {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setPosition(clamp(((clientX - box.left) / box.width) * 100));
  }
  return (
    <div className="split-compare">
      <div
        ref={frame}
        className="split-compare-frame"
        role="group"
        aria-label={label}
        aria-describedby={helpId}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          moveTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" && event.buttons !== 1) return;
          if (event.buttons === 1) moveTo(event.clientX);
        }}
      >
        <div className="split-compare-pane" aria-hidden="true">
          {after}
        </div>
        <div className="split-compare-pane split-compare-before" aria-hidden="true">
          {before}
        </div>
        <div className="split-compare-divider" aria-hidden="true">
          <span className="split-compare-grip" />
        </div>
        <input
          className="split-compare-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          aria-label={label}
          aria-valuetext={`${position}% ${beforeLabel} visible, ${100 - position}% ${afterLabel} visible`}
          onChange={(event) => setPosition(clamp(Number(event.target.value)))}
        />
      </div>
      <p className="split-compare-caption" id={helpId}>
        {caption ? `${caption} ` : ""}Left: {beforeLabel}. Right: {afterLabel}.
        Use the arrow keys, Home or End to move the divider.
      </p>
    </div>
  );
}
