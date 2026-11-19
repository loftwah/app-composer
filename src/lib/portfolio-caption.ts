// Human-facing caption formatting shared by the public portfolio view and its
// social-kit archive. Kept deliberately small: no private fields, no arbitrary
// prose, and no second source of truth for a caption the public page already shows.
import { dateLabel } from "./activity-view";
import { formatPortfolioValue, type Period, type PortfolioMetric } from "./portfolio-report";

export const portfolioQualityLabel = {
  exact: "Recorded", partial: "Partial coverage", bounded: "Bounded count",
  sampled: "Sampled", unavailable: "Unavailable",
} as const;

export function portfolioDateRange(period: Period): string {
  return `${dateLabel(period.from)} – ${dateLabel(period.to, true)} UTC`;
}

export function portfolioTotal(metric: PortfolioMetric): string {
  if (metric.value === null) return "—";
  return formatPortfolioValue(metric.value, metric.unit) +
    (metric.days.some((day) => day.capped) ? "+" : "");
}

export function portfolioCaption(input: {
  name: string;
  total: string;
  label: string;
  dateRange: string;
  quality: PortfolioMetric["quality"];
  canonical: string;
}): string {
  return `${input.name} · ${input.total} · ${input.label}\n` +
    `${input.dateRange} · ${portfolioQualityLabel[input.quality]}\n${input.canonical}`;
}
