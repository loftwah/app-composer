import { docsSearchCount, legacyDocsAnchors, searchDocs } from './docs-hub';
import { copyPromptText, docsCopyMessages } from './docs-copy';

/**
 * /docs interactivity: local filtering over the maintained task index and copy
 * buttons that read the server-rendered canonical prompt. No model call, no
 * network request and no execution authority.
 *
 * Copy is progressive enhancement. The page always renders the full prompt in
 * a native disclosure, so a blocked clipboard, an insecure context or no
 * JavaScript at all leaves a selectable copy behind. Every outcome is written
 * to a visible, announced status line; nothing fails silently.
 */

const legacyHash = (() => {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    // A malformed hash (for example a lone "%") must not break the page's
    // search or copy controls.
    return '';
  }
})();
if (legacyHash && (legacyDocsAnchors as readonly string[]).includes(legacyHash)) {
  location.replace(`/docs/how-it-works#${legacyHash}`);
}

const root = document.querySelector<HTMLElement>('[data-docs-hub]');

if (root) {
  const form = root.querySelector<HTMLElement>('[data-docs-search]');
  const input = root.querySelector<HTMLInputElement>('[data-docs-query]');
  const clear = root.querySelector<HTMLButtonElement>('[data-docs-clear]');
  const count = root.querySelector<HTMLElement>('[data-docs-count]');
  const empty = root.querySelector<HTMLElement>('[data-docs-empty]');

  for (const element of root.querySelectorAll<HTMLElement>('[data-docs-enhanced]')) {
    element.hidden = false;
  }
  root.dataset.enhanced = 'true';

  function setVisible(selector: string, visible: readonly string[]) {
    const shown = new Set(visible);
    for (const element of root!.querySelectorAll<HTMLElement>(selector)) {
      const key = element.dataset.docsTask ?? element.dataset.docsIndex ?? element.dataset.docsSection ?? element.dataset.docsGuide ?? element.dataset.docsUnavailable;
      element.hidden = key ? !shown.has(key) : false;
    }
  }

  function filter() {
    if (!input || !count) return;
    const result = searchDocs(input.value);
    setVisible('[data-docs-task]', result.tasks);
    setVisible('[data-docs-index]', result.tasks);
    setVisible('[data-docs-section]', result.sections);
    setVisible('[data-docs-guide]', result.guides);
    setVisible('[data-docs-unavailable]', result.unavailable);
    for (const group of root!.querySelectorAll<HTMLElement>('[data-docs-group]')) {
      group.hidden = !group.querySelector('[data-docs-task]:not([hidden]), [data-docs-index]:not([hidden]), [data-docs-section]:not([hidden]), [data-docs-guide]:not([hidden]), [data-docs-unavailable]:not([hidden])');
    }
    // Reference and unavailable indexes are collapsed so the hub stays
    // scannable. A search result must still be visible, so open the group that
    // contains a match and close the ones that do not.
    for (const details of root!.querySelectorAll<HTMLDetailsElement>('[data-docs-auto-open]')) {
      details.open = Boolean(input.value.trim() && details.querySelector('[data-docs-section]:not([hidden]), [data-docs-guide]:not([hidden]), [data-docs-unavailable]:not([hidden])'));
    }
    const total = docsSearchCount(result);
    const query = input.value.trim();
    count.textContent = total === 0
      ? 'No task or reference matches that wording.'
      : `${result.tasks.length} ${result.tasks.length === 1 ? 'task' : 'tasks'} · ${result.sections.length} reference · ${result.guides.length} ${result.guides.length === 1 ? 'guide' : 'guides'}${result.unavailable.length ? ` · ${result.unavailable.length} unavailable` : ''}`;
    if (empty) empty.hidden = total !== 0;
    if (clear) clear.hidden = !query;
  }

  function selectPrompt(id: string) {
    const details = root!.querySelector<HTMLDetailsElement>(`[data-docs-details="${id}"]`);
    if (details) details.open = true;
    const prompt = root!.querySelector<HTMLElement>(`[data-docs-prompt="${id}"]`);
    if (!prompt) return;
    prompt.focus();
    const range = document.createRange();
    range.selectNodeContents(prompt);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  /** One message per control, cleared so a repeated attempt is announced again. */
  const statusTimers = new WeakMap<HTMLElement, number>();

  /** Clear a previous message so the next outcome is announced again. */
  function setStatus(status: HTMLElement, message: string, clearAfter: number, state: 'copied' | 'failed' | 'empty') {
    const previous = statusTimers.get(status);
    if (previous) window.clearTimeout(previous);
    status.textContent = message;
    status.dataset.copyState = state;
    statusTimers.set(status, window.setTimeout(() => {
      // The manual fallback stays open and selected, so clearing the message
      // loses no instruction; it only keeps a stale "Copied" from lingering.
      status.textContent = '';
      delete status.dataset.copyState;
    }, clearAfter));
  }

  async function copyPrompt(id: string, button: HTMLButtonElement) {
    const prompt = root!.querySelector<HTMLElement>(`[data-docs-prompt="${id}"]`);
    const status = root!.querySelector<HTMLElement>(`[data-docs-status="${id}"]`);
    if (!prompt || !status) return;
    const text = prompt.textContent ?? '';
    const original = button.textContent ?? 'Copy prompt template';
    const outcome = await copyPromptText(text, navigator.clipboard?.writeText?.bind(navigator.clipboard));

    if (outcome === 'manual') {
      setStatus(status, docsCopyMessages.manual, 12000, 'failed');
      button.dataset.copyState = 'failed';
      // Let the polite status update start before focus moves into the
      // disclosure, so the message is not cut off by the focus change.
      window.setTimeout(() => selectPrompt(id), 60);
      window.setTimeout(() => { delete button.dataset.copyState; }, 12000);
      return;
    }
    if (outcome === 'empty') {
      setStatus(status, docsCopyMessages.empty, 12000, 'empty');
      return;
    }
    setStatus(status, docsCopyMessages.copied, 6000, 'copied');
    button.textContent = 'Copied';
    button.dataset.copyState = 'copied';
    window.setTimeout(() => {
      button.textContent = original;
      delete button.dataset.copyState;
    }, 6000);
  }

  input?.addEventListener('input', filter);
  // Escape clears a filtered page from anywhere in the hub, including a result
  // link reached with ArrowDown. The input's own handler keeps the field
  // focused; this one restores the full page and returns focus there.
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !input?.value) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target === input || target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    input.value = '';
    filter();
    input.focus();
    event.preventDefault();
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) {
      input.value = '';
      filter();
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown') {
      const first = root!.querySelector<HTMLAnchorElement>('[data-docs-index]:not([hidden]) a')
        ?? root!.querySelector<HTMLAnchorElement>('[data-docs-task]:not([hidden]) a')
        ?? root!.querySelector<HTMLAnchorElement>('[data-docs-guide]:not([hidden]) a, [data-docs-section]:not([hidden]) a, [data-docs-unavailable]:not([hidden]) a');
      first?.focus();
      event.preventDefault();
    }
  });
  clear?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    filter();
    input.focus();
  });
  for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-docs-example]')) {
    chip.addEventListener('click', () => {
      if (!input) return;
      input.value = chip.dataset.docsExample ?? '';
      filter();
      input.focus();
    });
  }
  // A filtered page hides non-matching tasks. Clear the search before following
  // an in-page task anchor so a closest route or next step is never a dead end.
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#path-"]')) {
    link.addEventListener('click', () => {
      if (!input?.value) return;
      input.value = '';
      filter();
    });
  }
  // A task detail is a native disclosure. Clear a filter first and open it so
  // the deep link lands on readable content, not a hidden or closed section.
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#detail-"]')) {
    link.addEventListener('click', () => {
      if (input?.value) {
        input.value = '';
        filter();
      }
      const target = document.getElementById(link.hash.slice(1));
      if (!(target instanceof HTMLDetailsElement)) return;
      target.open = true;
      // Keep the reader at the opened section and make its summary operable
      // without a second Tab through the rest of the page. The fragment
      // navigation runs after this handler, so restore focus on the next task.
      window.setTimeout(() => target.querySelector('summary')?.focus({ preventScroll: true }), 0);
    });
  }
  function openDetailFromHash() {
    const target = document.getElementById(location.hash.slice(1));
    if (target instanceof HTMLDetailsElement && target.hasAttribute('data-docs-details')) target.open = true;
  }
  addEventListener('hashchange', openDetailFromHash);
  openDetailFromHash();
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (!input) return;
    input.focus();
    event.preventDefault();
  });

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-docs-copy]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.docsCopy;
      if (id) void copyPrompt(id, button);
    });
  }

  if (form) filter();
}
