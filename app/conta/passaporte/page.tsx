import type { Metadata } from "next";
import SeasonPassportApp from "./SeasonPassportApp";

export const metadata: Metadata = { title: "Passaporte da temporada | Pelada Pede Mais Uma", description: "Acompanhe sua trajetória rodada por rodada." };
export default function SeasonPassportPage() { return <SeasonPassportApp/>; }
