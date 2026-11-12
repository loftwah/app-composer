import type { ProjectReference } from './project-direction.mjs';
import {
  referenceEvidenceScope,
  referenceInspectionHandoff,
  validateReferenceEvidence,
  type ReferenceEvidence,
} from './reference-evidence.mjs';

const statusLabels = {
  observed: 'Observed',
  partial: 'Partly observed',
  unavailable: 'Could not inspect',
};
const scopeKey = (references: ProjectReference[]) => JSON.stringify(referenceEvidenceScope(references));
const maxReportBytes = 64 * 1024;

export function bindReferenceEvidence(onEdit: () => void) {
  const copy = document.querySelector<HTMLButtonElement>('#copy-reference-request')!;
  const fallback = document.querySelector<HTMLPreElement>('#reference-request-text')!;
  const input = document.querySelector<HTMLInputElement>('#import-reference-evidence')!;
  const pasted = document.querySelector<HTMLTextAreaElement>('#reference-report-json')!;
  const reviewPaste = document.querySelector<HTMLButtonElement>('#review-reference-json')!;
  const status = document.querySelector<HTMLElement>('#reference-evidence-status')!;
  const review = document.querySelector<HTMLElement>('#reference-evidence-review')!;
  const agent = document.querySelector<HTMLElement>('#reference-evidence-agent')!;
  const results = document.querySelector<HTMLElement>('#reference-evidence-results')!;
  const help = document.querySelector<HTMLElement>('#reference-evidence-review-help')!;
  const attach = document.querySelector<HTMLButtonElement>('#use-reference-evidence')!;
  const dismiss = document.querySelector<HTMLButtonElement>('#dismiss-reference-evidence')!;

  let references: ProjectReference[] = [];
  let currentScope = scopeKey(references);
  let saved: ReferenceEvidence | undefined;
  let pending: ReferenceEvidence | undefined;
  let generation = 0;

  function attached() {
    return saved && scopeKey(saved.scope) === currentScope ? saved : undefined;
  }

  function renderReport() {
    const report = pending ?? attached();
    review.hidden = !report;
    attach.hidden = !pending;
    help.hidden = !pending;
    dismiss.textContent = pending ? 'Cancel review' : 'Remove report';
    results.replaceChildren();
    agent.textContent = '';
    if (!report) return;
    const identity = [report.agent.name, report.agent.surface, report.agent.version].filter(Boolean).join(' · ');
    agent.textContent = `Reported by ${identity} · ${report.inspectedAt}`;
    for (const [index, result] of report.results.entries()) {
      const entry = document.createElement('article');
      const heading = document.createElement('strong');
      heading.textContent = report.scope[index].source;
      const context = document.createElement('p');
      context.className = 'small';
      context.textContent = statusLabels[result.status] + (result.pageUrl ? ' · ' + result.pageUrl : '');
      entry.append(heading, context);
      for (const [label, items] of [['What the agent saw', result.observations], ['Gaps', result.gaps]] as const) {
        if (!items.length) continue;
        const caption = document.createElement('p');
        caption.textContent = label;
        const list = document.createElement('ul');
        for (const text of items) {
          const item = document.createElement('li');
          item.textContent = text;
          list.append(item);
        }
        entry.append(caption, list);
      }
      results.append(entry);
    }
  }

  function render(next: ProjectReference[]) {
    references = next;
    currentScope = scopeKey(next);
    generation++;
    pending = undefined;
    fallback.hidden = true;
    copy.disabled = input.disabled = pasted.disabled = reviewPaste.disabled = !referenceEvidenceScope(next).length;
    status.textContent = attached()
      ? 'Report attached. It travels with your draft and handoff.'
      : saved
        ? 'Your reference choices changed. Restore them to recover the report, or ask for a new one.'
        : copy.disabled
          ? 'Add a selected or exploratory reference to start.'
          : 'The request covers the current public references and asks for observations and gaps.';
    renderReport();
  }

  copy.addEventListener('click', async () => {
    const request = referenceInspectionHandoff(references);
    if (!request) return;
    const started = generation;
    try {
      await navigator.clipboard.writeText(request);
      if (started !== generation) return;
      fallback.hidden = true;
      status.textContent = 'Request copied. Paste it into your agent and open the report it returns.';
    } catch {
      if (started !== generation) return;
      fallback.textContent = request;
      fallback.hidden = false;
      fallback.focus();
      const range = document.createRange();
      range.selectNodeContents(fallback);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      status.textContent = 'Clipboard access failed. Copy the selected request and paste it into your agent.';
    }
  });

  function reviewText(text: string) {
    if (new Blob([text]).size > maxReportBytes) throw new Error('Use a JSON report up to 64 KB.');
    pending = validateReferenceEvidence(JSON.parse(text), references);
    if (!pending) throw new Error('The report is empty.');
    status.textContent = 'Review this report before attaching it.';
    renderReport();
    review.focus();
  }

  function reportError(error: unknown) {
    status.textContent = error instanceof SyntaxError
      ? 'Use the JSON object from your agent’s report.'
      : error instanceof Error ? error.message : 'The report could not be read.';
  }

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const started = ++generation;
    pending = undefined;
    renderReport();
    status.textContent = 'Reading the report…';
    try {
      if (file.size > maxReportBytes) throw new Error('Use a JSON report up to 64 KB.');
      const text = await file.text();
      if (started !== generation) return;
      reviewText(text);
    } catch (error) {
      if (started !== generation) return;
      reportError(error);
    }
  });

  reviewPaste.addEventListener('click', () => {
    generation++;
    pending = undefined;
    renderReport();
    try {
      reviewText(pasted.value);
    } catch (error) {
      reportError(error);
    }
  });

  attach.addEventListener('click', () => {
    if (!pending) return;
    saved = pending;
    pasted.value = '';
    render(references);
    onEdit();
    review.focus();
  });

  dismiss.addEventListener('click', () => {
    const cancelled = Boolean(pending);
    if (!cancelled) saved = undefined;
    render(references);
    if (!cancelled) onEdit();
    input.focus();
  });

  return {
    update(next: ProjectReference[]) {
      if (scopeKey(next) !== currentScope) render(next);
    },
    replace(report: ReferenceEvidence | undefined, next: ProjectReference[]) {
      saved = report;
      pasted.value = '';
      render(next);
    },
    forReferences(next: ProjectReference[]) {
      return saved && scopeKey(saved.scope) === scopeKey(next) ? saved : undefined;
    },
    snapshot() {
      return saved;
    },
  };
}
