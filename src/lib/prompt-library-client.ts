import { promptModules, promptModule, renderPrompt, readPromptDraft, promptStorageKey, type PromptValues } from './prompt-library';

const root = document.querySelector<HTMLElement>('[data-prompt-library]');
if (root) {
  const drafts: Record<string, PromptValues> = {};
  let selected = '';
  let sharedProject = '';
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement>(selector: string) => [...root.querySelectorAll<T>(selector)];
  const search = get<HTMLInputElement>('#prompt-search');
  const status = get<HTMLElement>('[data-draft-status]');
  function values(id: string): PromptValues { return drafts[id] ?? {}; }
  function showPreview(id: string, template = false) {
    const result = renderPrompt(id, values(id), { template });
    const article = get<HTMLElement>(`[data-prompt-job="${id}"]`);
    article.querySelector<HTMLElement>('[data-prompt-preview]')!.textContent = result.text;
    article.querySelector<HTMLElement>('[data-preview-mode]')!.textContent = template ? 'Template · replace bracketed details' : result.missing.length ? 'Needs your required details' : 'Exactly what you will copy';
    const manual = article.querySelector<HTMLTextAreaElement>('[data-manual] textarea')!;
    manual.value = result.text;
    return result;
  }
  function select(id: string, focus: boolean) {
    if (!promptModule(id)) id = 'setup';
    selected = id;
    for (const article of all<HTMLElement>('[data-prompt-job]')) article.hidden = article.dataset.promptJob !== id;
    for (const link of all<HTMLAnchorElement>('.prompt-tasks [data-prompt-link]')) {
      if (link.dataset.promptLink === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    showPreview(id);
    if (focus) get<HTMLElement>(`[data-prompt-job="${id}"] h2`).focus({ preventScroll: true });
  }
  function hashId(): string {
    try { const id = decodeURIComponent(location.hash.slice(1)); return promptModule(id)?.id ?? 'setup'; }
    catch { return 'setup'; }
  }
  function filter() {
    const query = search.value.trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    let count = 0;
    for (const item of promptModules) {
      const match = terms.every(term => `${item.title} ${item.category} ${item.description} ${item.id}`.toLocaleLowerCase().includes(term));
      get<HTMLElement>(`[data-task-row="${item.id}"]`).hidden = !match;
      if (match) count++;
    }
    for (const category of all<HTMLElement>('[data-category]')) category.hidden = !category.querySelector('li:not([hidden])');
    get<HTMLElement>('[data-empty]').hidden = count !== 0;
    get<HTMLElement>('#prompt-count').textContent = `${count} ${count === 1 ? 'job' : 'jobs'}${query ? ' found' : ' to choose from'}`;
  }
  function applyDrafts() {
    for (const form of all<HTMLFormElement>('[data-prompt-fields]')) {
      const id = form.dataset.promptFields!;
      for (const field of form.querySelectorAll<HTMLTextAreaElement>('textarea')) field.value = drafts[id]?.[field.name] ?? '';
    }
    showPreview(selected);
  }
  function validCompleted(id: string) {
    const result = showPreview(id);
    for (const field of all<HTMLTextAreaElement>(`[data-prompt-fields="${id}"] textarea`)) field.setAttribute('aria-invalid', String(result.missing.includes(field.name)));
    if (result.missing.length) {
      get<HTMLElement>(`[data-copy-status="${id}"]`).textContent = 'Add the required details, or use Copy template to fill them in with your agent.';
      get<HTMLTextAreaElement>(`[data-prompt-fields="${id}"] textarea[name="${result.missing[0]}"]`).focus();
      return null;
    }
    return result;
  }
  async function copy(id: string, template: boolean) {
    const result = template ? showPreview(id, true) : validCompleted(id);
    if (!result) return;
    const copyStatus = get<HTMLElement>(`[data-copy-status="${id}"]`);
    try {
      await navigator.clipboard.writeText(result.text);
      copyStatus.textContent = template ? 'Template copied. Replace its bracketed details in your agent.' : 'Prompt copied. Paste it into your agent to begin.';
      get<HTMLElement>(`[data-manual="${id}"]`).hidden = true;
    } catch {
      copyStatus.textContent = 'Your browser could not copy this. Select the complete prompt below and copy it manually.';
      get<HTMLElement>(`[data-manual="${id}"]`).hidden = false;
      const manual = get<HTMLTextAreaElement>(`[data-manual="${id}"] textarea`);
      manual.focus(); manual.select();
    }
  }
  for (const element of all<HTMLElement>('[data-enhanced]')) element.hidden = false;
  root.dataset.enhanced = 'true';
  for (const form of all<HTMLFormElement>('[data-prompt-fields]')) {
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', event => {
      const field = event.target;
      if (!(field instanceof HTMLTextAreaElement)) return;
      const id = form.dataset.promptFields!;
      drafts[id] ??= {};
      drafts[id][field.name] = field.value;
      // Reuse the project reference only in otherwise untouched module fields.
      if (field.name === 'project') for (const item of promptModules) {
        drafts[item.id] ??= {};
        if (!drafts[item.id].project || drafts[item.id].project === sharedProject) {
          drafts[item.id].project = field.value;
          get<HTMLTextAreaElement>(`[data-prompt-fields="${item.id}"] textarea[name="project"]`).value = field.value;
        }
      }
      if (field.name === 'project') sharedProject = field.value;
      field.removeAttribute('aria-invalid');
      get<HTMLElement>(`[data-copy-status="${id}"]`).textContent = '';
      get<HTMLElement>(`[data-manual="${id}"]`).hidden = true;
      showPreview(id);
    });
  }
  for (const link of all<HTMLAnchorElement>('[data-prompt-link]')) link.addEventListener('click', () => {
    search.value = ''; filter();
    select(link.dataset.promptLink!, true);
  });
  for (const button of all<HTMLButtonElement>('[data-copy-completed]')) button.addEventListener('click', () => void copy(button.dataset.copyCompleted!, false));
  for (const button of all<HTMLButtonElement>('[data-copy-template]')) button.addEventListener('click', () => void copy(button.dataset.copyTemplate!, true));
  for (const button of all<HTMLButtonElement>('[data-download]')) button.addEventListener('click', () => {
    const id = button.dataset.download!;
    const result = validCompleted(id);
    if (!result) return;
    const file = new Blob([`# ${promptModule(id)!.title}\n\n${result.text}\n`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `composer-${id}-prompt.md`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    get<HTMLElement>(`[data-copy-status="${id}"]`).textContent = 'Markdown download prepared from this completed prompt.';
  });
  get<HTMLButtonElement>('[data-save]').addEventListener('click', () => {
    try { localStorage.setItem(promptStorageKey, JSON.stringify({ version: 1, modules: drafts })); status.textContent = 'Prompt details saved on this device. Existing Init drafts are unchanged.'; }
    catch { status.textContent = 'This browser could not save details. They remain in this tab; copy or download the prompt before leaving.'; }
  });
  get<HTMLButtonElement>('[data-restore]').addEventListener('click', () => {
    try {
      const restored = readPromptDraft(localStorage.getItem(promptStorageKey));
      if (!restored) { status.textContent = 'No usable saved prompt details were found. Your current entries are unchanged.'; return; }
      for (const id of Object.keys(drafts)) delete drafts[id];
      Object.assign(drafts, restored); applyDrafts();
      sharedProject = drafts[selected]?.project ?? '';
      status.textContent = 'Saved prompt details restored. Existing Init drafts are unchanged.';
    } catch { status.textContent = 'This browser could not read saved details. Your current entries are unchanged.'; }
  });
  get<HTMLButtonElement>('[data-reset]').addEventListener('click', () => {
    for (const id of Object.keys(drafts)) delete drafts[id];
    sharedProject = '';
    applyDrafts();
    try { localStorage.removeItem(promptStorageKey); status.textContent = 'All prompt details cleared from this tab and this device. Existing Init drafts are unchanged.'; }
    catch { status.textContent = 'Prompt details cleared from this tab. This browser could not remove saved device data.'; }
  });
  search.addEventListener('input', filter);
  window.addEventListener('hashchange', () => { select(hashId(), true); });
  select(hashId(), false); filter();
}
