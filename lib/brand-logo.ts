export type BrandLogoFit = {
  width: number;
  height: number;
  aspectRatio: number;
};

/** Preserva a proporção intrínseca do arquivo dentro dos limites do cabeçalho. */
export function fitBrandLogo(
  naturalWidth: number,
  naturalHeight: number,
  maximumWidth: number,
  maximumHeight: number,
): BrandLogoFit {
  const safeWidth = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : 1;
  const safeHeight = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : 1;
  const safeMaximumWidth = Number.isFinite(maximumWidth) && maximumWidth > 0 ? maximumWidth : 1;
  const safeMaximumHeight = Number.isFinite(maximumHeight) && maximumHeight > 0 ? maximumHeight : 1;
  const aspectRatio = safeWidth / safeHeight;
  const scale = Math.min(safeMaximumWidth / safeWidth, safeMaximumHeight / safeHeight);

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    aspectRatio,
  };
}
