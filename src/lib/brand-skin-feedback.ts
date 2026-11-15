// Device-local sensory feedback for Brand Studio's optional Workshop press
// skin. Nothing here is written to the shared appearance record: one
// administrator's sound or haptics choice must never reach everyone using the
// same Composer admin. Both modalities are off unless the person turns them on.

export interface SkinSensoryPreference {
  sound: boolean;
  haptics: boolean;
}
export const sensoryOff: SkinSensoryPreference = {
  sound: false,
  haptics: false,
};
export const sensoryStorageKey = "composer:brand-studio:sensory:v1";

/** Stored values are data from this browser, so anything unexpected is off. */
export function parseSensoryPreference(raw: unknown): SkinSensoryPreference {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ...sensoryOff };
  const value = raw as { sound?: unknown; haptics?: unknown };
  return {
    sound: value.sound === true,
    haptics: value.haptics === true,
  };
}
export function serialiseSensoryPreference(
  preference: SkinSensoryPreference,
): string {
  return JSON.stringify(parseSensoryPreference(preference));
}
export function readSensoryPreference(
  storage: Pick<Storage, "getItem"> | undefined,
): SkinSensoryPreference {
  if (!storage) return { ...sensoryOff };
  try {
    const raw = storage.getItem(sensoryStorageKey);
    return parseSensoryPreference(raw === null ? null : JSON.parse(raw));
  } catch {
    return { ...sensoryOff };
  }
}
export function writeSensoryPreference(
  storage: Pick<Storage, "setItem"> | undefined,
  preference: SkinSensoryPreference,
) {
  if (!storage) return;
  try {
    storage.setItem(sensoryStorageKey, serialiseSensoryPreference(preference));
  } catch {
    // A blocked or full store keeps the choice for this page only.
  }
}

/** iOS Safari and most desktops do not implement navigator.vibrate. */
export function hapticsAvailable(
  navigatorLike: { vibrate?: unknown } | undefined,
): boolean {
  return typeof navigatorLike?.vibrate === "function";
}
export function soundAvailable(win: unknown): boolean {
  if (!win || typeof win !== "object") return false;
  const candidate = win as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  return (
    typeof candidate.AudioContext === "function" ||
    typeof candidate.webkitAudioContext === "function"
  );
}

export interface SkinTone {
  frequency: number;
  /** Seconds, kept short: a press, not a notification. */
  duration: number;
  gain: number;
  /** Seconds after the gesture, so the settle follows the press. */
  offset: number;
}
export interface SkinCuePlan {
  tones: readonly SkinTone[];
  hapticMs: readonly number[];
}

/** A press on the plate: one wooden tick, then a lighter settle. Reduced
 * motion keeps the direct tick and drops the settle and the buzz, so the
 * feedback still confirms the press without an added pulse. */
export function skinCuePlan(reducedMotion: boolean): SkinCuePlan {
  return reducedMotion
    ? {
        tones: [{ frequency: 196, duration: 0.024, gain: 0.045, offset: 0 }],
        hapticMs: [],
      }
    : {
        tones: [
          { frequency: 196, duration: 0.024, gain: 0.045, offset: 0 },
          { frequency: 262, duration: 0.016, gain: 0.03, offset: 0.055 },
        ],
        hapticMs: [12],
      };
}

export interface SkinCueResult {
  sound: boolean;
  haptics: boolean;
}
const contexts = new WeakMap<object, AudioContext>();
function audioContext(win: Window): AudioContext | null {
  const Constructor =
    (win as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (win as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (typeof Constructor !== "function") return null;
  const held = contexts.get(win);
  if (held) return held;
  try {
    const created = new Constructor();
    contexts.set(win, created);
    return created;
  } catch {
    return null;
  }
}
function playTones(context: AudioContext, plan: SkinCuePlan) {
  const start = context.currentTime;
  for (const tone of plan.tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = tone.frequency;
    const from = start + tone.offset;
    gain.gain.setValueAtTime(tone.gain, from);
    gain.gain.exponentialRampToValueAtTime(0.0001, from + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(from);
    oscillator.stop(from + tone.duration + 0.01);
  }
}

/** Plays only what the person enabled and this browser can actually do, and
 * reports exactly that so the interface never claims an unheard cue. Call it
 * from a deliberate gesture: no autoplay, and never from a typing handler. */
export function playSkinCue(
  win: Window,
  plan: SkinCuePlan,
  preference: SkinSensoryPreference,
): SkinCueResult {
  let sound = false,
    haptics = false;
  if (preference.sound && plan.tones.length) {
    const context = audioContext(win);
    if (context) {
      try {
        void context.resume();
        playTones(context, plan);
        sound = true;
      } catch {
        sound = false;
      }
    }
  }
  if (
    preference.haptics &&
    plan.hapticMs.length &&
    hapticsAvailable(win.navigator)
  ) {
    try {
      haptics = win.navigator.vibrate([...plan.hapticMs]);
    } catch {
      haptics = false;
    }
  }
  return { sound, haptics };
}
