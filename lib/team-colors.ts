const markers = [
  ["\uD83D\uDD34", 0xe53935], ["\uD83D\uDFE0", 0xfb8c00], ["\uD83D\uDFE1", 0xfbc02d], ["\uD83D\uDFE2", 0x43a047], ["\uD83D\uDD35", 0x1e88e5],
  ["\uD83D\uDFE3", 0x8e24aa], ["\uD83D\uDFE4", 0x6d4c41], ["\u26AB", 0x212121], ["\u26AA", 0xf5f5f5],
] as const;

function rgb(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
}

export function colorWithOpacity(color: string, opacity: number) {
  const value = rgb(color);
  if (!value) return "rgba(0,0,0,.08)";
  return `rgba(${value.red},${value.green},${value.blue},${Math.max(0, Math.min(1, opacity))})`;
}

export function readableTeamColor(color: string) {
  const value = rgb(color);
  if (!value) return "#15241F";
  const mix = (channel: number) => Math.round(channel * .62).toString(16).padStart(2, "0");
  return `#${mix(value.red)}${mix(value.green)}${mix(value.blue)}`;
}

export function contrastTextColor(color: string) {
  const value = rgb(color);
  if (!value) return "#FFFFFF";
  return (value.red * 299 + value.green * 587 + value.blue * 114) / 1000 >= 150 ? "#17221D" : "#FFFFFF";
}

export function teamColorMarker(color: string) {
  const value = rgb(color);
  if (!value) return "\u25CF";
  return markers.reduce((best, current) => {
    const markerValue = current[1];
    const distance = (value.red - ((markerValue >> 16) & 255)) ** 2
      + (value.green - ((markerValue >> 8) & 255)) ** 2
      + (value.blue - (markerValue & 255)) ** 2;
    return distance < best.distance ? { marker: current[0], distance } : best;
  }, { marker: "\u25CF", distance: Number.POSITIVE_INFINITY }).marker;
}
