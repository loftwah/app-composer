import { validateSpec } from './spec.mjs';

// The Learn resume link describes only a real, saved Init draft on this device.
// The same key and the same spec validator guard the draft when Init loads it,
// so a stale or malformed value cannot produce a misleading link. Kept out of
// the page script so the promise is unit-testable without a browser.
export const INIT_DRAFT_KEY = 'composer:init:v1';

export function savedInitDraftTitle(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return validateSpec(JSON.parse(raw)).config.title.trim();
  } catch {
    return null;
  }
}
