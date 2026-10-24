import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { exportWorkflow, workflowExport, workflowRecipes, type WorkflowKind, type WorkflowSnapshot, type WorkflowRun } from '../lib/workflow-contract';
import { workflowCall } from './workflows/api';
import { workspaceSelection } from './stacks/workspace-scope';
import './workflows-page.css';

export function WorkflowsPage() {
  const search = useLocation({ select: location => location.searchStr });
  return <Workflows key={search} search={search} />;
}
export function Workflows({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manual, setManual] = useState('');
  const pending = useRef(false), alive = useRef(true), generation = useRef(0);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);
  const sampleOperations = useRef<Record<string, string>>({});
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== 'viewer');

  async function run(action: string, fields: Record<string, unknown> = {}, message = '') {
    if (pending.current || invalidScope.current) return false;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    const epoch = ++generation.current;
    try {
      const result = await workflowCall(action, selection.current, fields);
      if (!alive.current || epoch !== generation.current) return false;
      selection.current = result.workspace.id;
      setSnapshot(result);
      setNames(previous => Object.fromEntries(result.recipes.map(recipe => [recipe.id, previous[recipe.id] ?? recipe.name])));
      if (message) setNotice(message);
      return true;
    } catch (cause) {
      if (alive.current && epoch === generation.current) setError(cause instanceof Error ? cause.message : 'This workflow could not be confirmed. Refresh before retrying.');
      return false;
    } finally {
      if (alive.current && epoch === generation.current) { pending.current = false; setBusy(false); }
    }
  }
  useEffect(() => {
    alive.current = true;
    try { selection.current = workspaceSelection(search); void run('list'); }
    catch (cause) { invalidScope.current = true; setError(cause instanceof Error ? cause.message : 'Choose a workspace from Workspace access.'); }
    return () => { alive.current = false; generation.current++; pending.current = false; };
  }, []);

  function save(recipe: WorkflowKind, enabled: boolean) {
    const current = snapshot?.recipes.find(value => value.id === recipe);
    if (!current) return;
    if (!names[recipe]?.trim()) { setError('Give this recipe a name before saving.'); return; }
    void run('save', { recipe, expectedRevision: current.revision, name: names[recipe], enabled }, enabled ? 'Recipe turned on. Use Scan now to check the current supported records.' : 'Recipe saved and paused. New scans and real-source retries are stopped.');
  }
  async function sample(recipe: WorkflowKind, fail: boolean) {
    const key = `${recipe}:${fail}`;
    sampleOperations.current[key] ??= crypto.randomUUID();
    if (await run('sample', { recipe, operation: sampleOperations.current[key], fail }, fail ? 'The sample failure is saved in history. Open it and restore the sample to exercise recovery.' : 'The sample result is saved in history. No live records or provider were changed.')) delete sampleOperations.current[key];
  }
  function download(name: string, value: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyResult(run: WorkflowRun) {
    if (!run.result) return;
    const text = `${run.result.title}\n\n${run.result.body}\n\n${new URL(run.result.href, 'https://composer.loftwah.com').href}`;
    try { await navigator.clipboard.writeText(text); setNotice('Draft copied. Review its actual source and support limits before sharing.'); setManual(''); }
    catch { setManual(text); setNotice('Your browser could not copy this. Select and copy the draft below.'); }
  }
  async function importRecipe(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8000) throw Error('Choose a recipe JSON file smaller than 8 KB.');
      const imported = workflowExport.parse(JSON.parse(await file.text()));
      if (!alive.current) return;
      setNames(previous => ({ ...previous, [imported.recipe]: imported.name }));
      setNotice('Recipe name and supported identity imported into the editor. Save paused to review it, then explicitly turn it on. Imports grant no access and contain no credentials.');
      setError('');
    } catch { if (alive.current) setError('This recipe is malformed or unsupported. Use a version 1 Composer recipe with its matching trigger/action and no secret values. Existing recipes are unchanged.'); }
  }

  return <div className="composer-workflows" aria-busy={busy}>
    <div className="cw-heading"><div><h1>Workflows</h1><p>Small useful recipes. A visible result and a safe way to deal with problems.</p></div><button type="button" disabled={busy || invalidScope.current} onClick={() => void run('list', {}, 'Saved recipes and history refreshed.')}>Refresh</button></div>
    <p className="cw-scope">{snapshot ? <>Workspace <strong>{snapshot.workspace.name}</strong> · {snapshot.workspace.role} · <strong>{snapshot.target.environment}</strong> <details><summary>Account and scope</summary><code>{snapshot.target.account}</code> · <code>{snapshot.workspace.id}</code></details></> : 'Confirming the selected workspace…'}</p>
    <div className="cw-links"><a href="/_emdash/admin/plugins/composer-stacks/workspaces">Workspace access</a><a href="/prompts#workflow">Prepare a workflow prompt</a><a href="/resources?resource=hook#resource">Hooks and external examples</a></div>
    {error && <p className="cw-error" role="alert">{error}</p>}
    <p className="cw-status" role="status">{busy ? 'Checking the saved recipe and source…' : notice}</p>
    <p className="cw-mode"><strong>On-demand native recipes.</strong> Scan now checks up to 20 current source records. Turning on enables that scan; it does not schedule background work. These recipes prepare private drafts and attention items. They send no email, publish nothing and run no remediation.</p>
    {snapshot && <>
      <section className="cw-recipes" aria-label="Native recipes">{workflowRecipes.map(recipe => {
        const saved = snapshot.recipes.find(value => value.id === recipe.id)!;
        const history = snapshot.runs.filter(run => run.recipe === recipe.id);
        return <article key={recipe.id} className="cw-recipe">
          <div className="cw-recipe-title"><h2>{recipe.name}</h2><span>{saved.enabled ? 'Ready to scan' : 'Paused'}</span></div>
          <dl className="cw-rule"><div><dt>When</dt><dd>{recipe.when}</dd></div><div><dt>If</dt><dd>{recipe.condition}</dd></div><div><dt>Do</dt><dd>{recipe.action}</dd></div></dl>
          <p>{recipe.help}</p>
          {!saved.scopeMatches && <p className="cw-error">This recipe was saved for another account or environment. Review the selected target before saving it here.</p>}
          <label htmlFor={`workflow-name-${recipe.id}`}>Name in your admin<input id={`workflow-name-${recipe.id}`} value={names[recipe.id] ?? saved.name} maxLength={80} disabled={busy || !canWrite} onChange={event => setNames(previous => ({ ...previous, [recipe.id]: event.target.value }))} /></label>
          <div className="cw-actions"><button type="button" disabled={busy || !canWrite} onClick={() => save(recipe.id, true)}>{saved.enabled ? 'Save & keep on' : 'Save & turn on'}</button><button type="button" disabled={busy || !canWrite} onClick={() => save(recipe.id, false)}>{saved.enabled ? 'Pause' : 'Save paused'}</button><button type="button" disabled={busy || !canWrite || !saved.enabled} onClick={() => void run('scan', { recipe: recipe.id, expectedRevision: saved.revision }, 'Scan finished. Current source revisions already in history were not repeated.')}>Scan now</button></div>
          <div className="cw-actions cw-secondary"><button type="button" disabled={busy || !canWrite} onClick={() => void sample(recipe.id, false)}>Try with sample data</button><button type="button" disabled={busy || !canWrite} onClick={() => void sample(recipe.id, true)}>Try an unavailable source</button><button type="button" disabled={busy || !(names[recipe.id] ?? saved.name).trim()} onClick={() => download(`composer-${recipe.id}.json`, exportWorkflow(recipe.id, names[recipe.id] ?? saved.name))}>Export recipe</button></div>
          <p className="cw-history-label">{history.length} {history.length === 1 ? 'run' : 'runs'} in recent history</p>
        </article>;
      })}</section>
      <section className="cw-history" aria-labelledby="workflow-history"><div className="cw-heading"><h2 id="workflow-history">Recent runs</h2><label className="cw-import">Import recipe<input type="file" accept=".json,application/json" disabled={busy || !canWrite} onChange={event => { void importRecipe(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
        <p>Latest 50 receipts, with a limit of 500 retained per workspace. Each source revision has one result. Sample runs are labelled and never count as live activity.</p>
        {!snapshot.runs.length && <p className="cw-empty">Try a sample to inspect the result. Turn on a recipe and scan when your workspace has a publication or a failed platform request.</p>}
        {snapshot.runs.map(run => <article key={run.id} className="cw-run">
          <div className="cw-run-title"><h3>{run.result?.title ?? workflowRecipes.find(recipe => recipe.id === run.recipe)!.name}</h3><span>{run.state === 'finished' ? 'Finished' : 'Needs attention'}{run.synthetic ? ' · Sample data' : ''}</span></div>
          <p>{run.message}</p>
          <ol className="cw-steps">{run.steps.map(step => <li key={step}>{({ observed: 'Source event retained', 'source-checked': 'Source checked', 'draft-prepared': 'Draft prepared' })[step]}</li>)}</ol>
          {run.result && <div className="cw-result"><p>{run.result.body}</p><div className="cw-actions"><a href={run.result.href}>Open the source</a><button type="button" disabled={busy} onClick={() => void copyResult(run)}>Copy draft</button></div></div>}
          {run.retryable && <button type="button" disabled={busy || !canWrite || (!run.synthetic && !snapshot.recipes.find(recipe => recipe.id === run.recipe)?.enabled)} onClick={() => void runAction(run)}>{run.synthetic ? 'Restore sample & retry' : 'Recheck source & retry'}</button>}
          <details className="cw-details"><summary>Operation details</summary><dl><dt>Source</dt><dd><code>{run.source}</code> · revision {run.sourceRevision}</dd><dt>Event</dt><dd><code>{run.event}</code></dd><dt>Run</dt><dd><code>{run.id}</code> · revision {run.revision}</dd><dt>Attempts</dt><dd>{run.attempts} of 3</dd><dt>Recipe revision</dt><dd>{run.recipeRevision}</dd><dt>Created</dt><dd>{run.createdAt} UTC</dd></dl></details>
        </article>)}
      </section>
    </>}
    {manual && <label className="cw-manual">Manual copy — select this draft<textarea value={manual} readOnly rows={8} onFocus={event => event.target.select()} /></label>}
  </div>;

  async function runAction(item: WorkflowRun) {
    await run('retry', { run: item.id, expectedRevision: item.revision }, 'The persisted source was checked again. Finished steps were not submitted to any external provider.');
  }
}
