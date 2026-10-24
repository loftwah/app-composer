/** Focus the requested, server-rendered record after an asynchronous native
 * screen loads. Fragments select a visible record and grant no access. */
export function focusStoredRecord(prefix: 'platform-request-' | 'workflow-run-' | 'notification-'): boolean {
  let id: string;
  try { id = decodeURIComponent(window.location.hash.slice(1)); }
  catch { return true; }
  if (!id.startsWith(prefix) || !/^[a-z0-9-]{6,120}$/.test(id)) return true;
  const element = document.getElementById(id);
  if (!element) return false;
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'start' });
  return true;
}
