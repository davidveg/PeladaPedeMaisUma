"use client";
import { useSyncExternalStore } from "react";
import FootballApp from "./FootballApp";
import { BrandedLoading } from "./components/BrandedLoading";
import OverviewApp from "./visao-geral/OverviewApp";
import "./visao-geral/overview.css";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
function currentView() {
  const params = new URLSearchParams(window.location.search);
  // Keep existing proposal/draft links; the default home is the match hub.
  return Boolean(params.get("matchId")) ? "builder" : "hub";
}
export default function HomeApp() {
  const view = useSyncExternalStore(subscribe, currentView, () => "loading");
  if (view === "loading") return <BrandedLoading variant="page" message="Carregando partidas…"/>;
  return view === "builder" ? <FootballApp/> : <OverviewApp initialNow={new Date().toISOString()}/>;
}
