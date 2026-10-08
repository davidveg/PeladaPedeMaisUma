"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PlayerPhoto } from "./PlayerPhoto";

export type PlayerPhotoOption = {
  id: string;
  displayName: string;
  photoUrl?: string | null;
};

export function PlayerPhotoSelect({ label, value, players, onChange, emptyLabel = "Selecionar jogador", disabled = false, className = "" }: {
  label: string;
  value: string;
  players: PlayerPhotoOption[];
  onChange(value: string): void;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const generatedId = useId().replace(/:/g, "");
  const listId = `player-photo-options-${generatedId}`;
  const selected = players.find(player => String(player.id) === String(value));
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <div className={`vote-player-select player-photo-select ${open ? "open" : ""} ${className}`.trim()} ref={root}>
    <button type="button" className="vote-player-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen(current => !current)}>
      {selected ? <PlayerPhoto photoUrl={selected.photoUrl} name={selected.displayName} className="vote-option-photo" previewSize={280} /> : <span className="vote-empty-photo" aria-hidden="true">👤</span>}
      <b>{selected?.displayName || emptyLabel}</b><i aria-hidden="true">{open ? "⌃" : "⌄"}</i>
    </button>
    {open && <div className="vote-player-options" id={listId} role="listbox" aria-label={label}>
      {value && <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }}>
        <span className="vote-empty-photo" aria-hidden="true">—</span><b>{emptyLabel}</b><span />
      </button>}
      {players.map(player => <button type="button" role="option" aria-selected={String(player.id) === String(value)} className={String(player.id) === String(value) ? "selected" : ""} key={player.id} onClick={() => { onChange(String(player.id)); setOpen(false); }}>
        <PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} className="vote-option-photo" previewSize={280} />
        <b>{player.displayName}</b>{String(player.id) === String(value) ? <span aria-hidden="true">✓</span> : <span />}
      </button>)}
    </div>}
  </div>;
}
