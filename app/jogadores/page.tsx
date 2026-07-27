import type { Metadata } from "next";
import FootballApp from "../FootballApp";

export const metadata: Metadata = {
  title: "Jogadores | Pelada Pede Mais Uma",
  description: "Consulte os jogadores, atributos e cards da pelada.",
};

export default function PlayersPage() {
  return <FootballApp initialStage="players"/>;
}
