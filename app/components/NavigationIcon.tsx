export type NavigationIconName = "dashboard" | "calendar" | "players" | "statistics" | "finance" | "account" | "settings" | "release" | "administrators" | "associations" | "moderators" | "identity" | "balance" | "career" | "audit";

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  let content;
  switch (name) {
    case "dashboard": content = <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>; break;
    case "calendar": content = <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>; break;
    case "players": content = <><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 4.5a3 3 0 0 1 0 5.8M17 14.5a5 5 0 0 1 3.5 4.8"/></>; break;
    case "statistics": content = <><path d="M4 20V4M4 20h16"/><path d="m7 16 4-5 3 2 5-7"/></>; break;
    case "finance": content = <><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>; break;
    case "account": content = <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6.8 18a6 6 0 0 1 10.4 0"/></>; break;
    case "settings": content = <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>; break;
    case "release": content = <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v6h14v-6"/></>; break;
    case "administrators": content = <><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="m17 11 3 1.5V15c0 2-1.2 3.5-3 4.5-1.8-1-3-2.5-3-4.5v-2.5L17 11Z"/></>; break;
    case "associations": content = <><path d="m10 13.5 4-3.9M8.5 16l-1.2 1.2a3.2 3.2 0 0 1-4.5-4.5L6 9.5A3.2 3.2 0 0 1 10.5 14M15.5 10a3.2 3.2 0 0 1-2-5.5l1.2-1.2a3.2 3.2 0 0 1 4.5 4.5L16 11a3.2 3.2 0 0 1-4.5 0"/></>; break;
    case "moderators": content = <><path d="m12 3 7 3v5c0 4.5-2.8 8.1-7 10-4.2-1.9-7-5.5-7-10V6l7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>; break;
    case "identity": content = <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2.2"/><path d="M5.5 16a3 3 0 0 1 5 0M13 10h5M13 14h5"/></>; break;
    case "balance": content = <><path d="M12 3v18M5 6h14"/><path d="m5 6-3 6h6L5 6Zm14 0-3 6h6l-3-6Z"/><path d="M8 21h8"/></>; break;
    case "career": content = <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>; break;
    case "audit": content = <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></>; break;
  }
  return <svg className="navigation-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true">{content}</svg>;
}
