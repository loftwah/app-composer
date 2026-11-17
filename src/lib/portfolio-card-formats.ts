export const portfolioCardFormats = {
  landscape: { width: 1200, height: 630, label: "Landscape" },
  square: { width: 1080, height: 1080, label: "Square" },
  portrait: { width: 1080, height: 1920, label: "Portrait" },
} as const;

export type PortfolioCardFormat = keyof typeof portfolioCardFormats;
export const portfolioCardFormat = (value: string | null): PortfolioCardFormat | null =>
  value === null || value === "landscape" ? "landscape" :
    value === "square" || value === "portrait" ? value : null;
