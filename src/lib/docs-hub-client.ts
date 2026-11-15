import { docsSearchCount, legacyDocsAnchors, searchDocs } from './docs-hub';

/**
 * /docs interactivity: local filtering over the maintained task index and copy
 * buttons that read the server-rendered canonical prompt. No model call, no
 * network request and no execution authority.
 */
const legacyHash = decodeURIComponent(location.hash.slice(1));
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
    prompt?.focus();
    if (!prompt) return;
    const range = document.createRange();
    range.selectNodeContents(prompt);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  input?.addEventListener('input', filter);
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
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (!input) return;
    input.focus();
    event.preventDefault();
  });

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-docs-copy]')) {
    button.addEventListener('click', async () => {
      const id = button.dataset.docsCopy;
      if (!id) return;
      const prompt = root.querySelector<HTMLElement>(`[data-docs-prompt="${id}"]`);
      const status = root.querySelector<HTMLElement>(`[data-docs-status="${id}"]`);
      if (!prompt || !status) return;
      try {
        await navigator.clipboard.writeText(prompt.textContent ?? '');
        status.textContent = 'Prompt template copied. Paste it into your chosen agent, then answer or replace the bracketed details.';
      } catch {
        status.textContent = 'This browser could not copy. The full prompt is selected below; copy it with your keyboard.';
        selectPrompt(id);
      }
    });
  }

  if (form) filter();
}
