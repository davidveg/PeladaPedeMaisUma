import type { Metadata } from "next";
import StatisticsApp from "./StatisticsApp";
import "./statistics.css";

export const metadata: Metadata = {
  title: "Estatísticas | Pelada Pede Mais Uma",
  description: "Recordes, destaques mensais, MVPs, artilharia, assistências e confrontos entre jogadores da pelada.",
};

export default function StatisticsPage() {
  return <StatisticsApp/>;
}
