import inventory from "../../docs/portfolio/woodhouse-inventory-20261116.json";

export type PortfolioProject = {
  id: string;
  name: string;
  site?: string;
  github?: string;
  endpoint?: string;
  measures: readonly string[];
  art?: string;
  tone: "amber" | "red" | "blue" | "green" | "violet" | "pink";
  category: string;
  lifecycle?: string;
};

const settings: Record<string, Omit<PortfolioProject, "id" | "name" | "site" | "lifecycle">> = {
  loftwahfm: { category: "Music", tone: "violet", art: "loftwahfm", github: "loftwah/loftwahfm",
    endpoint: "https://fm.loftwah.com/api/portfolio-analytics",
    measures: ["listening_starts", "listening_seconds", "game_listening_starts", "game_listening_seconds"] },
  fighter: { category: "Games", tone: "red", art: "fighter", github: "loftwah/fighter",
    endpoint: "https://fighter.loftwah.com/api/portfolio-analytics",
    measures: ["game_completions", "game_starts", "game_replays", "active_seconds"] },
  shoalshot: { category: "Games", tone: "blue", art: "shoalshot", github: "loftwah/shoalshot",
    endpoint: "https://woodhouse.loftwah.com/api/portfolio-analytics?project=shoalshot",
    measures: ["game_completions", "game_starts", "game_replays", "active_seconds"] },
  "protocol-11": { category: "Games", tone: "green", art: "protocol-11", github: "loftwah/protocol-11",
    endpoint: "https://woodhouse.loftwah.com/api/portfolio-analytics?project=protocol-11",
    measures: ["game_completions", "game_starts", "game_replays", "game_completions_classic",
      "game_completions_journey", "game_completions_private_room", "game_completions_public_matchmaking", "active_seconds"] },
  bubbles: { category: "Games", tone: "pink", art: "bubbles", github: "loftwah/bubbles",
    endpoint: "https://api.bubbles.loftwah.com/api/portfolio-analytics",
    measures: ["game_completions", "game_starts", "game_replays", "active_seconds"] },
  foilbury: { category: "Collecting", tone: "green", art: "foilbury", github: "loftwah/card-collector-bot",
    endpoint: "https://foilbury.loftwah.com/api/portfolio-analytics", measures: ["cabinet_views"] },
  max: { category: "Simulation", tone: "blue", github: "loftwah/max",
    endpoint: "https://max.loftwah.com/api/portfolio-analytics", measures: ["simulator_runs"] },
  liferaft: { category: "Desktop", tone: "amber", art: "liferaft", github: "loftwah/liferaft", measures: [] },
  "app-composer": { category: "Building", tone: "amber", art: "app-composer", github: "loftwah/app-composer",
    endpoint: "https://composer.loftwah.com/api/portfolio-analytics",
    measures: ["inspection_completed", "guest_postcards_received", "app_opens", "photo_opens"] },
};

const known = inventory.projects.map((project): PortfolioProject => ({
  id: project.id,
  name: project.name,
  site: project.live?.url ?? undefined,
  lifecycle: project.lifecycle,
  ...settings[project.id] ?? { category: "Archive", measures: [], tone: "blue" },
}));

export const portfolioProjects: PortfolioProject[] = [
  ...["loftwahfm", "fighter", "shoalshot", "protocol-11", "bubbles", "app-composer", "foilbury", "max", "liferaft"]
    .flatMap((id) => known.filter((project) => project.id === id)),
  { id: "woodhouse", name: "Woodhouse", site: "https://woodhouse.loftwah.com/", github: "loftwah/woodhouse-new",
    category: "Publishing", tone: "amber", endpoint: "https://woodhouse.loftwah.com/api/portfolio-analytics?project=woodhouse",
    measures: ["project_opens", "engaged_sessions", "active_seconds"] },
  { id: "media-studio", name: "Media Studio", site: "https://media.loftwah.com/", github: "loftwah/composer-media-studio",
    category: "Creative", art: "media-studio", tone: "red", measures: [] },
  ...known.filter((project) => !settings[project.id]),
];

export const portfolioArt = (project: PortfolioProject) =>
  project.art ? `/brand/portfolio/${project.art}-20261117.jpg` : undefined;
