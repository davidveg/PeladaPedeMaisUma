"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type PreviewPosition = { left: number; top: number };

export function PlayerPhoto({ photoUrl, name, large = false, className = "" }: { photoUrl?: string | null; name: string; large?: boolean; className?: string }) {
  const [preview, setPreview] = useState<PreviewPosition | null>(null);

  function showPreview(target: HTMLElement) {
    if (!photoUrl || large) return;
    const rect = target.getBoundingClientRect();
    const size = 220, margin = 12;
    const left = Math.max(margin, Math.min(window.innerWidth - size - margin, rect.left + rect.width / 2 - size / 2));
    const top = rect.top >= size + margin * 2 ? rect.top - size - margin : rect.bottom + margin;
    setPreview({ left, top });
  }

  return <span className={`player-avatar-wrap ${large ? "is-large" : ""}`} onMouseEnter={(event) => showPreview(event.currentTarget)} onMouseLeave={() => setPreview(null)}>
    <span className={`player-photo ${large ? "large-player-photo" : ""} ${className}`}>
      {photoUrl ? <img src={photoUrl} alt={`Foto de ${name}`} /> : <span className="player-placeholder" role="img" aria-label={`Foto padrão de ${name}`}>👤</span>}
    </span>
    {preview && photoUrl && typeof document !== "undefined" && createPortal(<span className="photo-hover-preview" role="tooltip" style={{ left: preview.left, top: preview.top }}><img src={photoUrl} alt={`Pré-visualização da foto de ${name}`} /><small>{name}</small></span>, document.body)}
  </span>;
}
