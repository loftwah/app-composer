import type { parseLocalBenchmarkResult } from './benchmark-local-result';
import type { PrivateBenchmarkRun, PrivateBenchmarkRunSummary, PrivateBenchmarkWorkspace } from './benchmark-private-runs';

type LocalResult = ReturnType<typeof parseLocalBenchmarkResult>;
const ENDPOINT = '/api/benchmarks/private-runs';

async function request<T>(query = {}, options?: RequestInit): Promise<T> {
  const params = new URLSearchParams(query).toString();
  const response = await fetch(params ? `${ENDPOINT}?${params}` : ENDPOINT, options);
  const data = await response.json();
  if (!response.ok || data?.ok !== true) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'The private history service is unavailable.');
  }
  return data as T;
}

export function mountPrivateBenchmarkHistory(
  getCurrent: () => LocalResult | null,
  openViewer: (result: LocalResult) => void,
) {
  const open = document.querySelector<HTMLButtonElement>('#private-history-open');
  const panel = document.getElementById('private-history-controls');
  const workspace = document.querySelector<HTMLSelectElement>('#private-history-workspace');
  const runs = document.querySelector<HTMLSelectElement>('#private-history-run');
  const save = document.querySelector<HTMLButtonElement>('#private-history-save');
  const reopen = document.querySelector<HTMLButtonElement>('#private-history-reopen');
  const download = document.querySelector<HTMLButtonElement>('#private-history-download');
  const remove = document.querySelector<HTMLButtonElement>('#private-history-remove');
  const status = document.getElementById('private-history-status');
  if (!open || !panel || !workspace || !runs || !save || !reopen || !download || !remove || !status) return;

  let busy = false;
  function refreshControls() {
    open!.disabled = busy;
    workspace!.disabled = busy || workspace!.options.length === 0;
    runs!.disabled = busy || runs!.options.length === 0;
    save!.disabled = busy || !workspace!.value || !getCurrent();
    reopen!.disabled = download!.disabled = remove!.disabled = busy || !runs!.value;
  }

  async function operate(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    refreshControls();
    try {
      await action();
    } catch (error) {
      status!.textContent = error instanceof Error ? error.message : 'Private history is unavailable.';
    } finally {
      busy = false;
      refreshControls();
    }
  }

  async function loadRuns(selectedId?: string) {
    runs!.replaceChildren();
    if (!workspace!.value) {
      status!.textContent = 'You do not have an owned workspace for private runs.';
      return;
    }
    const data = await request<{ runs: PrivateBenchmarkRunSummary[] }>({ workspace: workspace!.value });
    for (const run of data.runs) {
      runs!.add(new Option(`${run.packId ?? 'Local report'} · ${run.generatedAt} · ${run.sha256.slice(0, 12)}`, run.id));
    }
    if (selectedId) runs!.value = selectedId;
    status!.textContent = data.runs.length ? 'Choose a saved result to open or download.' : 'No private runs saved in this workspace.';
  }

  function currentRun() {
    return request<{ run: PrivateBenchmarkRun }>({ workspace: workspace!.value, id: runs!.value });
  }

  open.addEventListener('click', () => void operate(async () => {
    panel.hidden = true;
    status.textContent = 'Loading your owned workspaces…';
    const data = await request<{ workspaces: PrivateBenchmarkWorkspace[] }>();
    workspace.replaceChildren(...data.workspaces.map(({ id, name }) => new Option(name, id)));
    await loadRuns();
    panel.hidden = false;
  }));
  workspace.addEventListener('change', () => void operate(() => loadRuns()));
  runs.addEventListener('change', refreshControls);

  save.addEventListener('click', () => void operate(async () => {
    const current = getCurrent();
    if (!current || !workspace.value) return;
    const { source, generatedAt, suites, packId } = current;
    status.textContent = 'Saving the open report to this workspace…';
    const data = await request<{ run: PrivateBenchmarkRunSummary }>({ workspace: workspace.value }, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, generatedAt, suites, pack: packId ? { id: packId } : undefined }),
    });
    await loadRuns(data.run.id);
    status.textContent = 'Report saved in your private history.';
  }));

  reopen.addEventListener('click', () => void operate(async () => {
    const { run } = await currentRun();
    const { parseLocalBenchmarkResult: parse } = await import('./benchmark-local-result');
    openViewer(parse(run.report));
    status.textContent = 'Saved owner-imported result opened.';
  }));

  download.addEventListener('click', () => void operate(async () => {
    const { run } = await currentRun();
    const { id, sha256, verification, importedAt } = run;
    const file = new Blob([JSON.stringify({ ...run.report, privateRun: { id, sha256, verification, importedAt } }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `composer-benchmark-${id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    status.textContent = 'Portable JSON downloaded.';
  }));

  remove.addEventListener('click', () => void operate(async () => {
    if (!window.confirm('Delete the selected saved run from this workspace?')) return;
    await request({ workspace: workspace.value, id: runs.value }, { method: 'DELETE' });
    await loadRuns();
    status.textContent = 'Saved run deleted from this workspace.';
  }));

  refreshControls();
  return { refreshControls };
}
