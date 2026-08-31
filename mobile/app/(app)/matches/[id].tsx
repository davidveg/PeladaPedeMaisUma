import { useLocalSearchParams } from "expo-router";
import MatchHubDetail from "@/match-hub-detail";
export default function MatchDetailRoute() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return <MatchHubDetail key={`${id}:${tab}`} initialTab={tab} matchId={id}/>;
}
