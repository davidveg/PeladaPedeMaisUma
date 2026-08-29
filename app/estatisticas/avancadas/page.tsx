import type { Metadata } from "next";
import AdvancedStatisticsApp from "./AdvancedStatisticsApp";
import "./advanced-statistics.css";

export const metadata: Metadata = {
  title: "Estatísticas avançadas | Pelada Pede Mais Uma",
  description: "IPI, forma, consistência, entrosamento, impacto, recordes e qualidade do equilíbrio da pelada.",
};

export default function AdvancedStatisticsPage() { return <AdvancedStatisticsApp/>; }

