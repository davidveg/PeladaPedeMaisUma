import type { Metadata } from "next";
import MatchHubApp from "../partidas/MatchHubApp";

export const metadata: Metadata = {
  title: "Separações salvas | Pelada Pede Mais Uma",
  description: "Consulte os times e resultados das separações já confirmadas.",
};

export default function SavedSeparationsPage() {
  return <MatchHubApp/>;
}
