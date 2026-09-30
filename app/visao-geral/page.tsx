import type { Metadata } from "next";
import OverviewApp from "./OverviewApp";
import "./overview.css";

export const metadata: Metadata = { title: "Visão geral | Pelada Pede Mais Uma", description: "Resumo pessoal, próxima partida e destaques da pelada." };
export default function OverviewPage() { return <OverviewApp/>; }
