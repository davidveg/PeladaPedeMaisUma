"use client";

import { useEffect, useState } from "react";
import { COLOR_SCHEME_CHANGE_EVENT, COLOR_SCHEME_STORAGE_KEY, type SiteColorScheme } from "../../lib/color-scheme";

function currentScheme(): SiteColorScheme {
  return document.documentElement.dataset.colorScheme === "light" ? "light" : "dark";
}

function SchemeIcon({ scheme }: { scheme: SiteColorScheme }) {
  if (scheme === "light") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z"/></svg>;
}

export function ColorSchemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const [scheme, setScheme] = useState<SiteColorScheme>("dark");

  useEffect(() => {
    const sync = () => setScheme(currentScheme());
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== COLOR_SCHEME_STORAGE_KEY) return;
      const next = event.newValue === "light" ? "light" : "dark";
      document.documentElement.dataset.colorScheme = next;
      document.documentElement.style.colorScheme = next;
      setScheme(next);
    };
    sync();
    window.addEventListener(COLOR_SCHEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(COLOR_SCHEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  function select(next: SiteColorScheme) {
    const root = document.documentElement;
    root.dataset.colorScheme = next;
    root.style.colorScheme = next;
    try { window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next); } catch { /* A preferência ainda vale nesta página. */ }
    setScheme(next);
    window.dispatchEvent(new Event(COLOR_SCHEME_CHANGE_EVENT));
  }

  return <div className={`color-scheme-toggle${showLabels ? " color-scheme-toggle--labels" : ""}`} role="group" aria-label="Tema visual do site">
    {(["light", "dark"] as const).map(option => <button
      key={option}
      type="button"
      className={scheme === option ? "active" : undefined}
      aria-label={option === "light" ? "Usar tema claro" : "Usar tema escuro"}
      aria-pressed={scheme === option}
      title={option === "light" ? "Tema claro" : "Tema escuro"}
      onClick={() => select(option)}
    ><SchemeIcon scheme={option}/>{showLabels && <span>{option === "light" ? "Claro" : "Escuro"}</span>}</button>)}
  </div>;
}
