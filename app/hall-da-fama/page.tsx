import type { Metadata } from "next";
import HallOfFameApp from "./HallOfFameApp";
import "./hall-of-fame.css";

export const metadata: Metadata = {
  title: "Hall da Fama | Pelada Pede Mais Uma",
  description: "Ídolos, classes anuais, recordistas e momentos eternos da história da pelada.",
};

export default function HallOfFamePage() { return <HallOfFameApp/>; }
