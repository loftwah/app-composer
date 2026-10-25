import { useLocation } from "@tanstack/react-router";
import { Proposals } from "./proposals-page";

export function IncidentsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Proposals key={search} search={search} incidents />;
}
