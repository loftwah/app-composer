import { useEffect, useState } from "react";
import {
  appearanceSkinChoices,
  appearanceSkinName,
  skinIds,
  skinPressureNames,
  type SkinId,
} from "../lib/appearance-skin-catalogue";
import {
  hapticsAvailable,
  playSkinCue,
  readSensoryPreference,
  sensoryOff,
  skinCuePlan,
  soundAvailable,
  writeSensoryPreference,
  type SkinSensoryPreference,
} from "../lib/brand-skin-feedback";
import { SkinSpecimen } from "./SkinSpecimen";
import { SplitCompare } from "./SplitCompare";
import "../styles/appearance-lab.css";
import "../styles/appearance-skins.generated.css";

const LAB_KEY = "composer:appearance-lab:v1";
const LAB_SENSORY_KEY = "composer:appearance-lab:sensory:v1";

interface Choice {
  skin: SkinId;
  pressure: number;
}
const initialChoice: Choice = { skin: "composer", pressure: 2 };
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
function readChoice(store: Storage | undefined): Choice | null {
  if (!store) return null;
  try {
    const raw = JSON.parse(store.getItem(LAB_KEY) ?? "null") as {
      skin?: unknown;
      pressure?: unknown;
    } | null;
    if (
      raw &&
      typeof raw.skin === "string" &&
      skinIds.includes(raw.skin as SkinId) &&
      typeof raw.pressure === "number" &&
      Number.isInteger(raw.pressure) &&
      raw.pressure >= 1 &&
      raw.pressure <= 4
    )
      return { skin: raw.skin as SkinId, pressure: raw.pressure };
  } catch {
    // Unreadable local data is ignored; the default is the safe choice.
  }
  return null;
}

export function AppearanceLab() {
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const [stored, setStored] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const [sensory, setSensory] = useState<SkinSensoryPreference>(sensoryOff);
  const [support, setSupport] = useState({ sound: false, haptics: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cueNote, setCueNote] = useState("");

  useEffect(() => {
    const store = storage();
    const saved = readChoice(store);
    if (saved) {
      setChoice(saved);
      setStored(true);
    }
    const sound = soundAvailable(window),
      haptics = hapticsAvailable(navigator),
      preference = readSensoryPreference(store, LAB_SENSORY_KEY);
    setSupport({ sound, haptics });
    setSensory({
      sound: preference.sound && sound,
      haptics: preference.haptics && haptics,
    });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)"),
      follow = () => setReducedMotion(query.matches);
    follow();
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  function choose(patch: Partial<Choice>) {
    const next = { ...choice, ...patch };
    setChoice(next);
    setCueNote("");
    const store = storage();
    if (!store) {
      setStorageNote(
        "This browser blocks local storage, so the choice lasts for this visit only.",
      );
      return;
    }
    try {
      store.setItem(LAB_KEY, JSON.stringify(next));
      setStored(true);
      setStorageNote("");
    } catch {
      setStorageNote(
        "This browser refused the local save, so the choice lasts for this visit only.",
      );
    }
  }
  function reset() {
    setChoice(initialChoice);
    setCueNote("");
    const store = storage();
    try {
      store?.removeItem(LAB_KEY);
    } catch {
      // The visible default still applies.
    }
    setStored(false);
    setStorageNote("Reset to Composer default.");
  }
  function chooseSensory(patch: Partial<SkinSensoryPreference>) {
    const next = { ...sensory, ...patch };
    setSensory(next);
    writeSensoryPreference(storage(), next, LAB_SENSORY_KEY);
  }
  function press() {
    if (!sensory.sound && !sensory.haptics) {
      setCueNote(
        "Press feedback is off. The sample still shows its pressed edge.",
      );
      return;
    }
    const result = playSkinCue(window, skinCuePlan(reducedMotion), sensory);
    const played = [
      result.sound ? "a short tick" : "",
      result.haptics ? "a haptic tap" : "",
    ].filter(Boolean);
    setCueNote(
      played.length
        ? `Played ${played.join(" and ")} for this press only. Nothing else changed.`
        : "This browser did not play or vibrate the press cue. The pressed edge still shows the state.",
    );
  }

  const pressureLabel = skinPressureNames[choice.pressure - 1];
  const note = `${appearanceSkinName(choice.skin)}, ${pressureLabel.toLowerCase()} edge`;
  return (
    <div className="appearance-lab" data-appearance-lab>
      <div className="appearance-lab-controls">
        <fieldset>
          <legend>Skin</legend>
          <div className="appearance-lab-choices">
            {appearanceSkinChoices.map((option) => (
              <label key={option.id} className="appearance-lab-choice">
                <input
                  type="radio"
                  name="appearance-skin"
                  value={option.id}
                  checked={choice.skin === option.id}
                  onChange={() => choose({ skin: option.id as SkinId })}
                />
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="appearance-lab-pressure">
          Edge pressure
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={choice.pressure}
            aria-valuetext={`${pressureLabel} — ${choice.pressure} of 4`}
            onChange={(event) =>
              choose({ pressure: Number(event.target.value) })
            }
          />
          <span aria-hidden="true">
            {pressureLabel} · {choice.pressure} of 4
          </span>
        </label>
        <div className="appearance-lab-actions">
          <button type="button" onClick={reset}>
            Reset to Composer default
          </button>
          <p role="status" className="appearance-lab-status">
            {storageNote ||
              (stored
                ? "Saved on this device. This page reopens with the same skin."
                : "Composer default is showing. Choose a skin to try it.")}
          </p>
        </div>
      </div>

      <section aria-labelledby="lab-sample-title" className="appearance-lab-sample">
        <h3 id="lab-sample-title">Sample control</h3>
        <p>
          The same field, action and checkbox the admin uses, drawn with the
          chosen skin. The field keeps its 16px text and the action stays at
          least 44px tall.
        </p>
        <SkinSpecimen
          skin={choice.skin}
          pressure={choice.pressure}
          label="Chosen skin"
          note={note}
          status={cueNote}
          onPress={press}
        />
      </section>

      <section aria-labelledby="lab-feedback-title" className="appearance-lab-sensory">
        <h3 id="lab-feedback-title">Press feedback</h3>
        <p id="lab-feedback-help">
          Both are off until you turn them on. They are stored on this device
          only, and only the sample action can play them.
        </p>
        <label className="appearance-lab-check">
          <input
            type="checkbox"
            checked={sensory.sound}
            disabled={!support.sound}
            aria-describedby="lab-feedback-help"
            onChange={(event) => chooseSensory({ sound: event.target.checked })}
          />
          <span>
            Sound cue on this device
            <small>
              {support.sound
                ? "One short tick after you press the sample. No typing sounds, no autoplay."
                : "This browser does not expose Web Audio, so sound stays off. The press still works."}
            </small>
          </span>
        </label>
        <label className="appearance-lab-check">
          <input
            type="checkbox"
            checked={sensory.haptics}
            disabled={!support.haptics}
            aria-describedby="lab-feedback-help"
            onChange={(event) =>
              chooseSensory({ haptics: event.target.checked })
            }
          />
          <span>
            Haptic tap on supported devices
            <small>
              {support.haptics
                ? "One brief vibration after you press the sample. The device may ignore it."
                : "This browser does not report vibration support, so haptics stay off. Usual on iPhones and desktops."}
            </small>
          </span>
        </label>
        <p className="appearance-lab-hint">
          Reduced motion is {reducedMotion ? "on" : "off"} in this browser.{" "}
          {reducedMotion
            ? "The sample keeps its direct visual press and skips the settle tick and the haptic tap."
            : "Nothing in this skin animates; press feedback only confirms an action you took."}
        </p>
      </section>

      <section aria-labelledby="lab-compare-title" className="appearance-lab-compare">
        <h3 id="lab-compare-title">Compare with Composer default</h3>
        <SplitCompare
          label="Compare Composer default with the chosen skin"
          beforeLabel="Composer default"
          afterLabel={appearanceSkinName(choice.skin)}
          caption={`Composer default on the left; ${note} on the right.`}
          before={
            <SkinSpecimen
              presentational
              compact
              skin="composer"
              pressure={2}
              label="Composer default"
              note="Warm surfaces, orange actions, quiet rules"
            />
          }
          after={
            <SkinSpecimen
              presentational
              compact
              skin={choice.skin}
              pressure={choice.pressure}
              label={appearanceSkinName(choice.skin)}
              note={pressureLabel + " edge"}
            />
          }
        />
      </section>
    </div>
  );
}
