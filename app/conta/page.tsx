import type { Metadata } from "next";
import MemberApp from "./MemberApp";

export const metadata: Metadata = { title: "Minha conta | Pelada Pede Mais Uma", description: "Acesse seu perfil de jogador." };
export default function MemberPage() { return <MemberApp />; }
