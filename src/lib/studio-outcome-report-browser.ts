import { parseStudioOutcomeReport, type StudioOutcomeReport } from './studio-outcome-report';

const maxBytes = 64 * 1024;

const text = (tag: string, label: string, className?: string) => {
  const el = document.createElement(tag);
  el.textContent = label;
  if (className) el.className = className;
  return el;
};

function render(report: StudioOutcomeReport) {
  const heading = text('h3', 'Saved Studio export');
  const window = text('p', `${report.fromInclusive} to ${report.toExclusive} UTC (end date excluded)`, 'small');
  const captured = text('p', `Captured ${report.generatedAt} · Studio source ${report.revision}`, 'small');
  const list = document.createElement('ul');
  list.className = 'studio-outcome-metrics';
  list.setAttribute('aria-label', 'Saved Studio outcome metrics');
  const count = new Intl.NumberFormat();
  for (const metric of report.metrics) {
    const row = document.createElement('li');
    row.dataset.metric = metric.key;
    const value = metric.value === null ? 'Unavailable' : `${count.format(metric.value)} ${metric.unit.replaceAll('_', ' ')}`;
    const qualifier = metric.status === 'partial' ? ' · Partial coverage' : '';
    row.append(
      text('strong', metric.label),
      text('p', `${value}${qualifier}`, 'studio-outcome-value'),
      text('p', metric.coverage, 'small'),
      text('p', `Evidence · ${metric.evidenceLevel}`, 'small'),
    );
    list.append(row);
  }
  return [heading, window, captured, list];
}

export function mountStudioOutcomeReport() {
  const input = document.querySelector<HTMLInputElement>('#studio-outcome-file');
  const clear = document.querySelector<HTMLButtonElement>('#studio-outcome-clear');
  const status = document.getElementById('studio-outcome-status');
  const view = document.getElementById('studio-outcome-report');
  if (!input || !clear || !status || !view) return;

  let loadId = 0;
  input.disabled = false;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const request = ++loadId;
    clear.disabled = false;
    const resume = view.childElementCount ? ' The previous preview is still open.' : '';
    if (file.size > maxBytes) {
      status.textContent = 'Choose a Studio outcomes JSON file up to 64 KiB.' + resume;
      return;
    }
    status.textContent = 'Reading the report in this tab…';
    try {
      const raw = await file.text();
      if (request !== loadId) return;
      const report = parseStudioOutcomeReport(JSON.parse(raw));
      if (!report) throw Error('Invalid saved outcomes export');
      view.replaceChildren(...render(report));
      status.textContent = 'Studio report opened in this tab.';
    } catch {
      if (request === loadId)
        status.textContent = 'Choose a v1 JSON export from Studio Saved outcomes.' + resume;
    }
  });

  clear.addEventListener('click', () => {
    loadId++;
    input.value = '';
    view.replaceChildren();
    clear.disabled = true;
    status.textContent = 'Studio report cleared.';
    input.focus();
  });
}
