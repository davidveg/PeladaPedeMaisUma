const markerPalette = [
  ["🔴", 0xe53935], ["🟠", 0xfb8c00], ["🟡", 0xfbc02d], ["🟢", 0x43a047], ["🔵", 0x1e88e5],
  ["🟣", 0x8e24aa], ["🟤", 0x6d4c41], ["⚫", 0x212121], ["⚪", 0xf5f5f5],
] as const;

function rgbValue(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || "");
  return match ? Number.parseInt(match[1], 16) : null;
}

export function contrastTextColor(background: string) {
  const value = rgbValue(background);
  if (value === null) return "#FFFFFF";
  const red = (value >> 16) & 255, green = (value >> 8) & 255, blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 150 ? "#17221D" : "#FFFFFF";
}

export function teamColorMarker(color: string) {
  const value = rgbValue(color);
  if (value === null) return "●";
  const red = (value >> 16) & 255, green = (value >> 8) & 255, blue = value & 255;
  return markerPalette.reduce((best, current) => {
    const rgb = current[1];
    const distance = (red - ((rgb >> 16) & 255)) ** 2 + (green - ((rgb >> 8) & 255)) ** 2 + (blue - (rgb & 255)) ** 2;
    return distance < best.distance ? { marker: current[0], distance } : best;
  }, { marker: "●", distance: Number.POSITIVE_INFINITY }).marker;
}
