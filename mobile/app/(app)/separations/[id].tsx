import { useLocalSearchParams } from "expo-router";
import MatchHubDetail from "@/match-hub-detail";
// Kept for existing shared links and push notifications.
export default function SeparationDetailRoute() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return <MatchHubDetail key={`${id}:${tab}`} initialTab={tab} separationId={id}/>;
}
