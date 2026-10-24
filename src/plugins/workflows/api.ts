import { apiFetch, parseApiResponse } from 'emdash/plugin-utils';
import { workflowSnapshot, type WorkflowSnapshot } from '../../lib/workflow-contract';
import { confirmWorkspace } from '../stacks/workspace-scope';

const base = '/_emdash/api/plugins/composer-stacks/';
export async function workflowCall(action: string, workspace?: string, fields: Record<string, unknown> = {}): Promise<WorkflowSnapshot> {
  const read = action === 'list';
  const response = await apiFetch(base + (read ? 'workflowsRead?' + new URLSearchParams({ action, ...(workspace ? { workspace } : {}) }) : 'workflowsWrite'), read ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, action, workspace }) });
  const result = await parseApiResponse<unknown>(response, 'The workflow result could not be confirmed. Refresh its saved history before retrying.');
  const parsed = workflowSnapshot.safeParse(result);
  if (!parsed.success) {
    const error = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'The workflow response could not be validated. Your entries remain here; refresh before continuing.';
    throw Error(error);
  }
  confirmWorkspace(workspace, parsed.data.workspace.id);
  return parsed.data;
}
