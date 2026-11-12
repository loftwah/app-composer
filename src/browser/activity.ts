// Progressive enhancement only. The native GET tabs, no-script forms and
// daily-value tables remain the complete public report without this file.
// One selected-day cursor powers mouse, tap and keyboard inspection.
const root = document.querySelector<HTMLElement>("[data-activity]");

if (root) {
  const panels = [
    ...root.querySelectorAll<HTMLElement>("[data-trend]"),
  ];
  const tabs = [
    ...root.querySelectorAll<HTMLAnchorElement>("[data-metric-tab]"),
  ];

  const url = (metric: string, day?: string) => {
    try {
      const next = new URL(location.href);
      next.searchParams.set("metric", metric);
      if (day) next.searchParams.set("day", day);
      else next.searchParams.delete("day");
      window.history.replaceState(null, "", next);
    } catch {
      /* Native Show signal and full page loads remain available. */
    }
  };

  const panelDay = (panel: HTMLElement) => {
    const range = panel.querySelector<HTMLInputElement>("[data-day-range]");
    const rows = panel.querySelectorAll<HTMLTableRowElement>("[data-day-text]");
    const index = Number(range?.value ?? rows.length - 1);
    return rows[index]?.dataset.dayDate;
  };

  const selectDay = (panel: HTMLElement, date: string) => {
    const range = panel.querySelector<HTMLInputElement>("[data-day-range]");
    const rows = [
      ...panel.querySelectorAll<HTMLTableRowElement>("[data-day-date]"),
    ];
    const index = rows.findIndex((row) => row.dataset.dayDate === date);
    if (!range || index < 0) return;
    range.value = String(index);
    range.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const show = (metric: string, updateUrl = true) => {
    let previous: HTMLElement | undefined;
    let visible: HTMLElement | undefined;
    for (const panel of panels) {
      if (!panel.hidden) previous = panel;
      const active = panel.dataset.metric === metric;
      panel.hidden = !active;
      if (active) visible = panel;
    }
    for (const tab of tabs) {
      const active = tab.dataset.metricTab === metric;
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    if (visible) {
      const heading = root?.querySelector<HTMLElement>("[data-chart-title]");
      if (heading && visible.dataset.trendLabel)
        heading.textContent = visible.dataset.trendLabel;
      // Keep the inspected UTC day when the reader switches signal.
      const date = previous && previous !== visible ? panelDay(previous) : undefined;
      if (date) selectDay(visible, date);
    }
    if (updateUrl) url(metric, visible ? panelDay(visible) : undefined);
  };

  for (const tab of tabs) {
    tab.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      show(tab.dataset.metricTab ?? "");
    });
  }

  for (const panel of panels) {
    const range = panel.querySelector<HTMLInputElement>("[data-day-range]");
    const date = panel.querySelector<HTMLElement>("[data-readout-date]");
    const value = panel.querySelector<HTMLElement>("[data-readout-value]");
    const unit = panel.querySelector<HTMLElement>("[data-readout-unit]");
    const state = panel.querySelector<HTMLElement>("[data-readout-state]");
    const rows = [
      ...panel.querySelectorAll<HTMLTableRowElement>("[data-day-text]"),
    ];
    const points = [
      ...panel.querySelectorAll<SVGGElement>("[data-day-index]"),
    ];
    const previous = panel.querySelector<HTMLButtonElement>('[data-step="-1"]');
    const next = panel.querySelector<HTMLButtonElement>('[data-step="1"]');
    if (!range || !date || !value || !state || !rows.length) continue;

    const inspect = (candidate: number, syncUrl = true) => {
      const index = Math.max(0, Math.min(rows.length - 1, candidate));
      const point = points[index];
      if (!point) return;
      range.value = String(index);
      const text = rows[index].dataset.dayText ?? "";
      range.setAttribute("aria-valuetext", text);
      date.textContent = `${point.dataset.dayLong ?? rows[index].dataset.dayDate} · UTC`;
      value.textContent = point.dataset.dayValue ?? "";
      state.textContent = point.dataset.dayState ?? "";
      if (unit)
        unit.hidden = value.textContent === "Unavailable";
      for (const other of points)
        other.classList.toggle(
          "is-inspected",
          Number(other.dataset.dayIndex) === index,
        );
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === rows.length - 1;
      if (syncUrl && !panel.hidden)
        url(panel.dataset.metric ?? "", point.dataset.dayDate);
    };

    range.addEventListener("input", () => inspect(range.valueAsNumber));
    previous?.addEventListener("click", () =>
      inspect(Number(range.value) - 1),
    );
    next?.addEventListener("click", () => inspect(Number(range.value) + 1));

    const plot = panel.querySelector<SVGSVGElement>("[data-trend-plot]");
    const pointAt = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<SVGGElement>("[data-day-index]")
        : null;
    plot?.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const point = pointAt(event.target);
      if (point) inspect(Number(point.dataset.dayIndex));
    });
    plot?.addEventListener("pointerdown", (event) => {
      const point = pointAt(event.target);
      if (point) inspect(Number(point.dataset.dayIndex));
    });
    // Keyboard users get the labelled range plus these buttons; clicking a
    // column is an equivalent visible shortcut, never the only way in.
  }

  root.classList.add("activity-enhanced");
}
