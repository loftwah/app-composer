/** Copy decision for the shared tutorial quick starts.
 *
 * The visible prompt panel is the source of truth. This module copies that
 * exact string: no trimming, rewriting or template interpolation happens here,
 * so the text a reader can select and the clipboard text cannot drift apart.
 * It stays free of DOM access so the denied, unsupported and empty paths are
 * exercised deterministically by the focused test.
 */

export type TutorialCopyOutcome = 'copied' | 'manual' | 'empty';

export const tutorialCopyMessages = {
  copied: 'Copied. The panel text and the clipboard text are the same.',
  manual:
    'Copy failed. The prompt text is selected.',
  empty: 'The prompt text did not load. Select it in the panel or reload the page.',
} as const;

/**
 * `write` is the Clipboard API's writeText, or undefined when the browser has
 * no Clipboard API (an insecure context, for example). A rejection is a denied
 * permission, a lost document focus or an unsupported platform: all of them
 * lead to the visible manual fallback rather than a silent no-op.
 */
export async function copyTutorialPrompt(
  text: string,
  write?: ((value: string) => Promise<unknown>) | null,
): Promise<TutorialCopyOutcome> {
  if (!text.trim()) return 'empty';
  if (typeof write !== 'function') return 'manual';
  try {
    await write(text);
    return 'copied';
  } catch {
    return 'manual';
  }
}
