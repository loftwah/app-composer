import { validateBenchmarkSuite } from './benchmark-suite.mjs';
import { MAX_LOCAL_BENCHMARK_BYTES } from './benchmark-local-retention';

const MAX_DETAILS = 8;
const MAX_VISIBLE_CHECKS = 100;

function element(tag: string, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountBenchmarkSuiteFile(useInProject: (definition: unknown) => void) {
  const input = document.querySelector<HTMLInputElement>('#suite-definition-file');
  const status = document.getElementById('suite-definition-status');
  const view = document.getElementById('suite-definition-view');
  const clear = document.querySelector<HTMLButtonElement>('#suite-definition-clear');
  if (!input || !status || !view || !clear) return;

  const known = new Set<string>();
  try {
    const pairs: [string, string][] = JSON.parse(input.dataset.knownChecks ?? '[]');
    for (const [module, id] of pairs) known.add(`${module}::${id}`);
  } catch {
    known.clear();
  }

  let request = 0;
  input.disabled = false;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const selected = ++request;
    clear.disabled = false;
    view.replaceChildren();
    if (file.size > MAX_LOCAL_BENCHMARK_BYTES) {
      status.textContent = 'Choose a JSON suite definition up to 1 MB.';
      return;
    }

    status.textContent = 'Reading suite definition…';
    try {
      const raw = await file.text();
      if (selected !== request) return;
      const definition: unknown = JSON.parse(raw);
      const { ok, issues, summary } = validateBenchmarkSuite(definition);
      const list = element('ul');
      if (!ok || !summary) {
        for (const issue of issues.slice(0, MAX_DETAILS)) list.append(element('li', issue.detail.slice(0, 200)));
        view.append(list);
        status.textContent = `Suite definition has ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}.`;
        return;
      }

      const knownCount = summary.checks.filter(check => known.has(`${check.module}::${check.id}`)).length;
      for (const check of summary.checks.slice(0, MAX_VISIBLE_CHECKS)) {
        const key = `${check.module}::${check.id}`;
        list.append(element('li', `${key} · ${known.has(key) ? 'In this catalogue' : 'Outside this catalogue'}`));
      }
      const evidence = summary.evidenceState === 'not-run'
        ? 'Not run. This definition declares no result.'
        : 'Unverified evidence. Open the recorded run separately to check the named result.';
      view.append(
        element('h3', `${summary.id} · ${summary.name}`),
        element('p', summary.description),
        element('p', evidence),
        element('h4', 'Provider-free checks'),
        list,
      );
      if (summary.checks.length > MAX_VISIBLE_CHECKS)
        view.append(element('p', `Showing the first ${MAX_VISIBLE_CHECKS} references.`));
      if (summary.checks.length <= MAX_VISIBLE_CHECKS && knownCount === summary.checks.length && file.size <= 32_768) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'button secondary';
        action.textContent = 'Use in project suites';
        action.addEventListener('click', () => useInProject(definition));
        view.append(action);
      }
      status.textContent = `Valid definition. ${knownCount} of ${summary.checks.length} checks appear in this catalogue.`;
    } catch {
      if (selected === request) status.textContent = 'Choose a readable JSON suite definition.';
    }
  });

  clear.addEventListener('click', () => {
    request++;
    input.value = '';
    view.replaceChildren();
    status.textContent = '';
    clear.disabled = true;
    input.focus();
  });
}
