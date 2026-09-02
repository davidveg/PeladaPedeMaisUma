export async function renderRecapPng(element: HTMLElement, title: string): Promise<File> {
  await document.fonts?.ready;
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, {
    backgroundColor: "#fbf7ed",
    cacheBust: true,
    pixelRatio: 2,
  });
  if (!blob) throw new Error("Não foi possível gerar a imagem da resenha.");
  const name = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resenha-da-pelada";
  return new File([blob], `${name}.png`, { type: "image/png" });
}

export function downloadRecapPng(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function shareRecapFile(file: File, title: string, message: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const data: ShareData = { title, text: message, files: [file] };
  if (navigator.share && navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error: any) {
      if (error?.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  downloadRecapPng(file);
  return "downloaded";
}
