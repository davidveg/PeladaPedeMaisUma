"use client";

import { useState } from "react";
import { hallRecordBadgePath } from "../../lib/hall-record-badges";

export function HallRecordBadge({ id, icon, title }: { id: string; icon?: string; title: string }) {
  const src = hallRecordBadgePath(id);
  const [failedSrc, setFailedSrc] = useState("");
  const failed = !src || failedSrc === src;

  return <span className="hall-record-badge" role="img" aria-label={title}>
    {failed ? <span aria-hidden="true">{icon || "🏆"}</span> : <img src={src} alt="" onError={() => setFailedSrc(src)}/>} 
  </span>;
}
