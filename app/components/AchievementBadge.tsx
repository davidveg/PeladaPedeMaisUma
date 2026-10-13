"use client";

import { useState } from "react";
import { achievementBadgePath } from "../../lib/achievement-badges";

export function AchievementBadge({ id, icon, title, className = "" }: { id: string; icon?: string; title: string; className?: string }) {
  const src = achievementBadgePath(id);
  const [failedSrc, setFailedSrc] = useState("");
  const failed = failedSrc === src;
  return <span className={`achievement-badge${className ? ` ${className}` : ""}`} role="img" aria-label={title}>
    {failed ? <span aria-hidden="true">{icon || "🏆"}</span> : <img src={src} alt="" onError={() => setFailedSrc(src)}/>} 
  </span>;
}
