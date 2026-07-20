import type { Metadata } from "next";
import MatchDraftApp from "./MatchDraftApp";

export const metadata: Metadata = { title: "Rascunho da partida | Pelada Pede Mais Uma", description: "Registre os gols e assistências da partida em andamento." };

export default function MatchDraftPage() { return <MatchDraftApp />; }
