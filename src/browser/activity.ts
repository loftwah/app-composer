// Progressive enhancement only. Native GET forms and daily-value tables remain
// the complete public report when scripting, history or pointer input is absent.
const historyRoot = document.querySelector<HTMLElement>(
  "[data-activity-history]",
);
if (historyRoot) {
  const picker = historyRoot.querySelector<HTMLSelectElement>(
    "[data-signal-picker]",
  );
  const panels = [
    ...historyRoot.querySelectorAll<HTMLElement>("[data-signal]"),
  ];
  picker?.addEventListener("change", () => {
    if (!panels.some((panel) => panel.dataset.signal === picker.value)) return;
    for (const panel of panels)
      panel.hidden = panel.dataset.signal !== picker.value;
    // A browser that refuses history updates still has a fully usable report.
    try {
      const url = new URL(location.href);
      url.searchParams.set("metric", picker.value);
      window.history.replaceState(null, "", url);
    } catch {
      /* Native Show signal remains available. */
    }
    for (const field of document.querySelectorAll<HTMLInputElement>(
      "input[type=hidden][name=metric]",
    ))
      field.value = picker.value;
  });
  for (const panel of panels) {
    const range = panel.querySelector<HTMLInputElement>("[data-day-range]");
    const description = panel.querySelector<HTMLElement>(
      "[data-day-description]",
    );
    const rows = [
      ...panel.querySelectorAll<HTMLTableRowElement>("[data-day-text]"),
    ];
    const points = [...panel.querySelectorAll<SVGGElement>("[data-day-index]")];
    const previous = panel.querySelector<HTMLButtonElement>('[data-step="-1"]');
    const next = panel.querySelector<HTMLButtonElement>('[data-step="1"]');
    const inspect = (value: number) => {
      if (!range || !description || !rows.length) return;
      const index = Math.max(0, Math.min(rows.length - 1, value));
      range.value = String(index);
      const text = rows[index].dataset.dayText ?? "";
      range.setAttribute("aria-valuetext", text);
      description.textContent = text;
      for (const point of points)
        point.classList.toggle(
          "is-inspected",
          Number(point.dataset.dayIndex) === index,
        );
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === rows.length - 1;
    };
    range?.addEventListener("input", () => inspect(range.valueAsNumber));
    previous?.addEventListener("click", () =>
      inspect(Number(range?.value ?? 0) - 1),
    );
    next?.addEventListener("click", () =>
      inspect(Number(range?.value ?? 0) + 1),
    );
    panel
      .querySelector("[data-signal-plot]")
      ?.addEventListener("pointermove", (event) => {
        const pointer = event as PointerEvent;
        if (
          pointer.pointerType !== "mouse" ||
          !(pointer.target instanceof Element)
        )
          return;
        const point = pointer.target.closest<SVGGElement>("[data-day-index]");
        if (point) inspect(Number(point.dataset.dayIndex));
      });
  }
  historyRoot.classList.add("activity-enhanced");
}
