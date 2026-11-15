import type { SkinId } from "../lib/appearance-skin-catalogue";
import "../styles/skin-specimen.css";

interface Props {
  skin: SkinId;
  pressure: number;
  label: string;
  note?: string;
  /** A visual copy for the comparison wipe: no focusable controls. */
  presentational?: boolean;
  /** Hide the specimen's own label and status so two panes align exactly. */
  compact?: boolean;
  pressLabel?: string;
  status?: string;
  onPress?: () => void;
}

/** One reviewed sample of a skin. The fields are real controls so the specimen
 * proves focus, edge and field behaviour rather than a picture of it. */
export function SkinSpecimen({
  skin,
  pressure,
  label,
  note,
  presentational = false,
  compact = false,
  pressLabel = "Press the sample",
  status,
  onPress,
}: Props) {
  const root = {
    className: `skin-specimen${presentational ? " skin-specimen-static" : ""}${
      compact ? " skin-specimen-compact" : ""
    }`,
    "data-composer-skin": skin,
    "data-composer-pressure": pressure,
    ...(presentational ? { "aria-hidden": true as const, inert: true } : {}),
  };
  return (
    <div {...root}>
      {compact ? null : (
        <p className="skin-specimen-label">
          <strong>{label}</strong>
          {note ? <span>{note}</span> : null}
        </p>
      )}
      <div className="skin-specimen-panel">
        <span className="skin-specimen-field">
          <span className="skin-specimen-field-label">Admin name</span>
          {presentational ? (
            <span className="skin-specimen-input">App Composer</span>
          ) : (
            <input
              type="text"
              aria-label={`${label}: sample admin name`}
              defaultValue="App Composer"
            />
          )}
        </span>
        <div className="skin-specimen-row">
          {presentational ? (
            <>
              <span className="skin-specimen-button">{pressLabel}</span>
              <span className="skin-specimen-check">Keep this on</span>
            </>
          ) : (
            <>
              <button type="button" onClick={onPress}>
                {pressLabel}
              </button>
              <label className="skin-specimen-check">
                <input type="checkbox" defaultChecked /> Keep this on
              </label>
            </>
          )}
        </div>
      </div>
      {status ? (
        <p className="skin-specimen-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
