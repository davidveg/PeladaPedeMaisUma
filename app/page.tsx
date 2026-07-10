import type { Metadata } from "next";
import FootballApp from "./FootballApp";
export const metadata:Metadata={title:"Pelada Pede Mais Uma",description:"Times equilibrados, sem discussão no grupo."};
export default function Home(){return <FootballApp/>}
