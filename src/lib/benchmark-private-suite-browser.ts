import type {
  PrivateBenchmarkSuite as PrivateBenchmarkSuiteFull,
  PrivateBenchmarkSuiteScope,
  PrivateBenchmarkSuiteSummary,
} from './benchmark-private-suites';

type Scope = Pick<PrivateBenchmarkSuiteScope, 'workspaceId' | 'projectId'>;
type Workspace = { id: string; name: string };
type Project = { id: string; name: string };

const ENDPOINT = '/api/benchmarks/private-suites';

async function request<T>(query: Record<string, string> = {}, options?: RequestInit): Promise<T> {
  const params = new URLSearchParams(query).toString();
  const response = await fetch(params ? `${ENDPOINT}?${params}` : ENDPOINT, options);
  let data: { ok?: boolean; error?: string } | null = null;
  try {
    data = await response.json();
  } catch {
    throw new Error('The private suite service returned an invalid response.');
  }
  if (!response.ok || data?.ok !== true) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'The private suite service is unavailable.');
  }
  return data as T;
}

function definitionSummary(definition: unknown): string {
  if (definition === null || typeof definition !== 'object') return 'No suite definition is open in this tab.';
  const value = definition as { id?: unknown; name?: unknown; checks?: unknown };
  const id = typeof value.id === 'string' && value.id ? value.id : 'unnamed-id';
  const name = typeof value.name === 'string' && value.name ? value.name : 'Unnamed suite';
  const checks = Array.isArray(value.checks) ? value.checks.length : 0;
  return `${id} · ${name} · ${checks} ${checks === 1 ? 'check' : 'checks'}`;
}

/**
 * Mount the private suite controls supplied by the parent page. Returns the
 * setter the parent uses to hand over the currently open native definition.
 * Calling the setter never fetches and never uploads: it only records what the
 * parent has opened so Save can be enabled once a workspace and project are
 * chosen. Mounting itself also performs no request; nothing is fetched until
 * the explicit "Open project suites" button is clicked.
 */
export function mountPrivateBenchmarkSuites(): (definition: unknown | null) => void {
  const root = document.querySelector<HTMLElement>('#private-suites');
  const find = <T extends Element>(selector: string) =>
    root?.querySelector<T>(selector) ?? document.querySelector<T>(selector);

  const access = find<HTMLButtonElement>('#private-suite-access');
  const workspace = find<HTMLSelectElement>('#private-suite-workspace');
  const project = find<HTMLSelectElement>('#private-suite-project');
  const status = find<HTMLElement>('#private-suite-status');
  const summary = find<HTMLElement>('#private-suite-definition');
  const save = find<HTMLButtonElement>('#private-suite-save');
  const list = find<HTMLElement>('#private-suite-list');
  if (!access || !workspace || !project || !status || !summary || !save || !list) return () => {};

  let current: unknown | null = null;
  let requestId = 0;
  let busy = false;

  // A scope is captured as a value, never re-read mid-operation, so a list,
  // open or delete can never be applied to a different workspace/project.
  const scopeOf = (): Scope => ({ workspaceId: workspace!.value, projectId: project!.value });
  const scopeKey = (scope: Scope) => `${scope.workspaceId}\u0000${scope.projectId}`;
  const isCurrent = (token: number, scope: Scope) =>
    token === requestId && scopeKey(scope) === scopeKey(scopeOf());
  const say = (message: string) => { status!.textContent = message; };

  function refreshControls() {
    access!.disabled = busy;
    workspace!.disabled = busy || workspace!.options.length === 0;
    project!.disabled = busy || !workspace!.value || project!.options.length === 0;
    // Saving requires an explicit sign-in-owned workspace, project and definition.
    save!.disabled = busy || !workspace!.value || !project!.value || current === null;
  }

  function clearProjects() {
    project!.replaceChildren();
  }

  function clearSuites() {
    list!.replaceChildren();
  }

  type Operation = (token: number, scope: Scope) => Promise<void>;

  /** One action at a time. A token and the scope at its start make every
   * result conditional: a changed workspace, project or current definition
   * invalidates anything already in flight, so no stale response can repaint
   * a different scope. */
  async function operate(action: Operation) {
    if (busy) return;
    const token = ++requestId;
    const scope = scopeOf();
    busy = true;
    refreshControls();
    try {
      await action(token, scope);
    } catch (error) {
      if (isCurrent(token, scope))
        say(error instanceof Error ? error.message : 'Private suites are unavailable.');
    } finally {
      busy = false;
      refreshControls();
    }
  }

  async function loadProjects(token: number, scope: Scope, selectedId?: string) {
    clearSuites();
    if (!scope.workspaceId) {
      clearProjects();
      refreshControls();
      say(workspace!.options.length ? 'Choose a workspace to see its projects.' : 'Sign in as a workspace owner to open private suites.');
      return;
    }
    say('Loading your workspace projects…');
    const data = await request<{ projects: Project[] }>({ workspace: scope.workspaceId });
    if (!isCurrent(token, scope)) return;
    const choices = data.projects.map(({ id, name }) => new Option(name, id));
    if (choices.length) choices.unshift(new Option('Choose a project', ''));
    project!.replaceChildren(...choices);
    if (selectedId && data.projects.some(({ id }) => id === selectedId)) project!.value = selectedId;
    refreshControls();
    say(data.projects.length ? 'Choose a project to list its private suites.' : 'This workspace has no projects you can open.');
  }

  function renderSuites(suites: PrivateBenchmarkSuiteSummary[]) {
    const rows = suites.map(suite => {
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = `${suite.name} · ${suite.id} · ${suite.checks} checks · ${suite.sha256.slice(0, 12)} · ${suite.importedAt}`;
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.textContent = 'Download JSON';
      openButton.className = 'button secondary';
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.className = 'button secondary';
      openButton.addEventListener('click', () => void operate((token, scope) =>
        openSavedSuite(suite.id, token, scope)));
      removeButton.addEventListener('click', () => void operate((token, scope) =>
        removeSavedSuite(suite.id, token, scope)));
      row.className = 'packs-actions';
      row.append(label, openButton, removeButton);
      return row;
    });
    list!.replaceChildren(...rows);
  }

  async function loadSuites(token: number, scope: Scope) {
    clearSuites();
    if (!scope.workspaceId || !scope.projectId) {
      refreshControls();
      say('Choose a workspace and a project to list its private suites.');
      return;
    }
    say('Loading private suites…');
    const data = await request<{ suites: PrivateBenchmarkSuiteSummary[] }>({
      workspace: scope.workspaceId,
      project: scope.projectId,
    });
    if (!isCurrent(token, scope)) return;
    renderSuites(data.suites);
    say(data.suites.length ? 'Choose a saved definition to open or remove.' : 'No private suites saved in this project.');
  }

  async function openSavedSuite(id: string, token: number, scope: Scope) {
    say('Opening the saved native suite definition…');
    const { suite } = await request<{ suite: PrivateBenchmarkSuiteFull }>({
      workspace: scope.workspaceId,
      project: scope.projectId,
      id,
    });
    if (!isCurrent(token, scope)) return;
    const blob = new Blob([JSON.stringify(suite.definition, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suite.id.toLowerCase() + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    say('Saved suite JSON downloaded.');
  }

  async function removeSavedSuite(id: string, token: number, scope: Scope) {
    if (!window.confirm(`Remove ${id} from the selected project?`)) return;
    say('Deleting the saved definition…');
    await request({ workspace: scope.workspaceId, project: scope.projectId, id }, { method: 'DELETE' });
    if (!isCurrent(token, scope)) return;
    await loadSuites(token, scope);
    say('Saved definition removed from this project.');
  }

  function applyDefinition(definition: unknown | null) {
    current = definition;
    summary!.textContent = definitionSummary(current);
    refreshControls();
  }

  access.addEventListener('click', () => void operate(async (token, scope) => {
    say('Loading your owned workspaces…');
    const data = await request<{ workspaces: Workspace[] }>();
    if (!isCurrent(token, scope)) return;
    const previous = workspace!.value;
    const choices = data.workspaces.map(({ id, name }) => new Option(name, id));
    if (choices.length) choices.unshift(new Option('Choose a workspace', ''));
    workspace!.replaceChildren(...choices);
    if (previous && data.workspaces.some(({ id }) => id === previous)) workspace!.value = previous;
    refreshControls();
    if (workspace!.value) {
      clearProjects();
      await loadProjects(token, scopeOf(), project!.value);
      return;
    }
    clearProjects();
    clearSuites();
    refreshControls();
    say(data.workspaces.length
      ? 'Choose a workspace you own, then a project.'
      : 'Sign in as a workspace owner to open private suites.');
  }));

  workspace.addEventListener('change', () => {
    // Clear dependent state before capturing the new scope so the operation
    // cannot look stale the moment it starts.
    clearProjects();
    clearSuites();
    refreshControls();
    void operate((token, scope) => loadProjects(token, scope));
  });

  project.addEventListener('change', () => {
    clearSuites();
    refreshControls();
    void operate((token, scope) => loadSuites(token, scope));
  });

  save.addEventListener('click', () => void operate(async (token, scope) => {
    const definition = current;
    if (!scope.workspaceId || !scope.projectId || definition === null) {
      say('Sign in, choose a workspace and project, then open a suite definition before saving.');
      return;
    }
    say('Saving the open definition to this project…');
    const data = await request<{ suite: PrivateBenchmarkSuiteSummary }>({
      workspace: scope.workspaceId,
      project: scope.projectId,
    }, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    });
    if (!isCurrent(token, scope)) return;
    await loadSuites(token, scope);
    say(`Saved ${data.suite.name} in this private project.`);
  }));

  summary!.textContent = definitionSummary(current);
  refreshControls();
  return applyDefinition;
}
