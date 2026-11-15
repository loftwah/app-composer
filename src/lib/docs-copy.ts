/** Copy decision for the public documentation pages.
 *
 * Kept free of DOM access so the denied, unsupported and empty paths can be
 * exercised deterministically. The page still owns the disclosure, selection,
 * focus and status rendering; this only decides what happened.
 */

export type DocsCopyOutcome = 'copied' | 'manual' | 'empty';

export const docsCopyMessages = {
  copied: 'Copied. Paste it into your chosen agent, then answer or replace the bracketed details.',
  manual:
    'Copy failed — the full prompt is open and selected below. Copy it with your keyboard shortcut or your device’s copy menu.',
  empty: 'The prompt text did not load on this page. Open the prompt library instead.',
} as const;

/**
 * `write` is the Clipboard API's writeText, or undefined when the browser has
 * no Clipboard API at all (an insecure context, for example). A rejection is a
 * denied permission, a lost document focus or an unsupported platform: all of
 * them lead to the same visible manual fallback rather than a silent no-op.
 */
export async function copyPromptText(
  text: string,
  write?: ((value: string) => Promise<unknown>) | null,
): Promise<DocsCopyOutcome> {
  const value = text.replace(/^\n+|\n+$/g, '');
  if (!value.trim()) return 'empty';
  if (typeof write !== 'function') return 'manual';
  try {
    await write(value);
    return 'copied';
  } catch {
    return 'manual';
  }
}
