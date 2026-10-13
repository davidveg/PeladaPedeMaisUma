"use client";

import { useState } from "react";
import { collectiveBadgePath } from "../../lib/collective-badges";

export function CollectiveBadge({ kind, icon, title, className = "" }: { kind: string; icon?: string; title: string; className?: string }) {
  const src = collectiveBadgePath(kind);
  const [failedSrc, setFailedSrc] = useState("");
  const failed = failedSrc === src;
  return <span className={`collective-badge${className ? ` ${className}` : ""}`} role="img" aria-label={title}>
    {failed ? <span aria-hidden="true">{icon || "🏆"}</span> : <img src={src} alt="" onError={() => setFailedSrc(src)}/>}
  </span>;
}
