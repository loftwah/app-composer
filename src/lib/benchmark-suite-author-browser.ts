import { createSuiteDefinition, type SuiteAuthorBase } from './benchmark-suite-author';

export function mountSuiteAuthor() {
  const form = document.querySelector<HTMLFormElement>('#suite-author');
  const baseSelect = document.querySelector<HTMLSelectElement>('#suite-author-base');
  const checkList = document.getElementById('suite-author-checks');
  const id = document.querySelector<HTMLInputElement>('#suite-author-id');
  const name = document.querySelector<HTMLInputElement>('#suite-author-name');
  const description = document.querySelector<HTMLTextAreaElement>('#suite-author-description');
  const status = document.getElementById('suite-author-status');
  const command = document.getElementById('suite-author-command');
  const submit = document.querySelector<HTMLButtonElement>('#suite-author-download');
  if (!form || !baseSelect || !checkList || !id || !name || !description || !status || !command || !submit) return;

  let catalogue: SuiteAuthorBase[];
  try {
    catalogue = JSON.parse(form.dataset.catalogue ?? '[]');
  } catch {
    status.textContent = 'The source catalogue is unavailable.';
    return;
  }
  if (!catalogue.length) return;

  const ids = catalogue.map(pack => pack.id);
  for (const pack of catalogue) baseSelect.add(new Option(pack.name, pack.id));
  baseSelect.disabled = false;
  submit.disabled = false;

  const choosePack = () => {
    for (const row of checkList.querySelectorAll('label')) row.remove();
    const base = catalogue.find(pack => pack.id === baseSelect.value);
    if (!base) return;
    for (const [index, check] of base.checks.entries()) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(index);
      label.append(input, `${check.module} · ${check.id}`);
      checkList.append(label);
    }
  };
  baseSelect.addEventListener('change', choosePack);
  form.addEventListener('input', () => {
    status.textContent = '';
    command.textContent = '';
  });
  choosePack();

  form.addEventListener('submit', event => {
    event.preventDefault();
    const base = catalogue.find(pack => pack.id === baseSelect.value);
    if (!base) return;
    const picked = Array.from(checkList.querySelectorAll<HTMLInputElement>('input:checked'), input => Number(input.value));
    const { spec, issues } = createSuiteDefinition(base, picked, {
      id: id.value, name: name.value, description: description.value,
    }, ids);
    if (!spec) {
      status.textContent = issues[0] ?? 'Check the definition and try again.';
      return;
    }

    const filename = `${spec.id.toLowerCase()}.json`;
    const file = new Blob([JSON.stringify(spec, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    status.textContent = 'Suite definition downloaded.';
    const folder = base.directory === 'benchmarks/cloudflare-composition' ? ' --suites benchmarks/cloudflare-composition' : '';
    command.textContent = `Place ${filename} in ${base.directory} in your checkout, then run:\nnode benchmarks/runner.mjs${folder} --suite ${spec.id}`;
  });
}
