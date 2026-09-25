"use client";

import type { MouseEvent } from "react";

export function NotificationBell({ unread = 0, onClick }: {
  unread?: number;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const count = Math.max(0, Number(unread) || 0);
  const label = count > 99 ? "99+" : String(count);
  return <a className="notification-bell-link" href="/notificacoes" data-unread={label} aria-label={count ? `Abrir notificações, ${count} não lidas` : "Abrir notificações"} onClick={onClick}>
    <svg className="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  </a>;
}
