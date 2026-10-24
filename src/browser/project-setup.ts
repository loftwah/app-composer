import { defaultSetupDetails, normaliseSetupDetails, renderProjectSetupGuide, setupGuideVersion } from '../lib/project-setup';

const storageKey = 'app-composer.project-setup.v1';
const maxDraftLength = 60000;

export function initProjectSetup(): void {
  const workspace = document.querySelector<HTMLElement>('[data-setup-workspace]');
  if (!workspace) return;
  const form = workspace.querySelector<HTMLFormElement>('form');
  const preview = workspace.querySelector<HTMLTextAreaElement>('[data-setup-preview]');
  const status = workspace.querySelector<HTMLElement>('[data-setup-status]');
  const rebuild = workspace.querySelector<HTMLButtonElement>('[data-setup-rebuild]');
  if (!form || !preview || !status || !rebuild) return;
  let edited = false;
  let storageAvailable = true;
  let copyGeneration = 0;

  const announce = (message: string) => { status.textContent = message; };
  const readForm = () => {
    const values = new FormData(form);
    return normaliseSetupDetails({
      mode: values.get('mode'), target: values.get('target'), project: values.get('project'),
      outcome: values.get('outcome'), constraints: values.get('constraints'), deploy: values.has('deploy'),
    });
  };
  const fillForm = (value: unknown) => {
    const details = normaliseSetupDetails(value);
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name="mode"]')) input.checked = input.value === details.mode;
    for (const name of ['project', 'outcome', 'constraints', 'target'] as const) {
      const control = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      control.value = details[name];
    }
    (form.elements.namedItem('deploy') as HTMLInputElement).checked = details.deploy;
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: setupGuideVersion, details: readForm(), guide: preview.value.slice(0, maxDraftLength), edited }));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      announce('This browser could not save your guide. Copy or download it before leaving.');
    }
  };
  const regenerate = () => {
    preview.value = renderProjectSetupGuide(readForm());
    edited = false;
    rebuild.hidden = true;
    save();
    if (storageAvailable) announce('Guide updated and saved in this browser. Review, copy or download it.');
  };
  const manualCopy = () => {
    preview.focus();
    preview.select();
    preview.setSelectionRange(0, preview.value.length);
    announce('Automatic copy was unavailable. The complete guide is selected; use your device’s Copy command.');
  };

  fillForm(defaultSetupDetails);
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw && raw.length <= maxDraftLength * 6 + 12000) {
      const draft = JSON.parse(raw);
      if (draft?.version === setupGuideVersion && draft.details && typeof draft.guide === 'string' && draft.guide.length <= maxDraftLength) {
        fillForm(draft.details);
        preview.value = draft.guide;
        edited = draft.edited === true;
        announce('Restored the guide saved in this browser. Review it against your current project before use.');
      }
    }
  } catch { announce('The saved guide could not be restored. The template is ready; copy or download before leaving.'); }
  const modeFromLink = location.hash.slice(1);
  if (['new', 'existing', 'resume'].includes(modeFromLink) && modeFromLink !== readForm().mode) {
    fillForm({ ...readForm(), mode: modeFromLink });
    if (!edited) regenerate();
    else {
      rebuild.hidden = false;
      announce('The linked starting point is selected. Your edited guide is preserved; apply details to replace it.');
    }
  }
  for (const control of workspace.querySelectorAll<HTMLElement>('[data-setup-controls]')) control.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => {
    copyGeneration += 1;
    if (edited) {
      rebuild.hidden = false;
      save();
      if (storageAvailable) announce('Details saved. Your edited guide is preserved; apply details to replace it with a fresh guide.');
    } else regenerate();
  });
  preview.addEventListener('input', () => {
    copyGeneration += 1;
    edited = true;
    save();
    if (storageAvailable) announce('Your guide edits are saved here and included in copy and download.');
  });
  rebuild.addEventListener('click', regenerate);
  workspace.querySelector('[data-setup-copy]')?.addEventListener('click', async () => {
    const generation = ++copyGeneration;
    const text = preview.value;
    if (!text.trim()) { announce('The guide is empty. Apply your details to create a fresh guide first.'); rebuild.hidden = false; return; }
    try {
      if (!navigator.clipboard?.writeText) { manualCopy(); return; }
      await navigator.clipboard.writeText(text);
      if (generation === copyGeneration) announce('Setup guide copied. Paste it into your coding agent.');
    } catch { if (generation === copyGeneration) manualCopy(); }
  });
  workspace.querySelector('[data-setup-download]')?.addEventListener('click', () => {
    if (!preview.value.trim()) { announce('The guide is empty. Apply your details to create a fresh guide first.'); rebuild.hidden = false; return; }
    const url = URL.createObjectURL(new Blob([preview.value], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project-setup.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Markdown download started. It contains the same guide shown in the preview.');
  });
  workspace.querySelector('[data-setup-reset]')?.addEventListener('click', () => {
    copyGeneration += 1;
    fillForm(defaultSetupDetails);
    preview.value = renderProjectSetupGuide(defaultSetupDetails);
    edited = false;
    rebuild.hidden = true;
    try { localStorage.removeItem(storageKey); announce('This device’s setup guide was reset. Other Composer drafts are unchanged.'); }
    catch { announce('The page was reset, but browser storage could not be cleared.'); }
  });
}
