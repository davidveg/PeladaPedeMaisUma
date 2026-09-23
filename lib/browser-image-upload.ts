const MAX_UPLOAD_BYTES = 5_000_000;
const PROXY_SAFE_BYTES = 900_000;

export type BrowserImageVariant = "photo" | "logo" | "favicon" | "share";

type UploadPayload = { url?: string; error?: string };

export async function uploadBrowserImage(file: File, options: { purpose?: "branding"; variant: BrowserImageVariant }) {
  validateSelectedImage(file, options.variant);
  const prepared = await prepareImage(file, options.variant);
  const headers: Record<string, string> = {
    "content-type": prepared.type || "application/octet-stream",
    "x-file-name": encodeURIComponent(prepared.name),
  };
  if (options.purpose) headers["x-upload-purpose"] = options.purpose;

  const response = await fetch("/api/upload", { method: "POST", headers, body: prepared });
  const payload = await uploadResponsePayload(response);
  if (!response.ok) throw new Error(payload.error || `Não foi possível enviar a imagem (${response.status}).`);
  if (!payload.url) throw new Error("O servidor concluiu o upload, mas não retornou a URL da imagem.");
  return payload.url;
}

export async function uploadResponsePayload(response: Response): Promise<UploadPayload> {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body) as UploadPayload;
  } catch {
    if (response.status === 413) {
      return { error: "O servidor recusou a imagem por tamanho. A imagem será otimizada automaticamente; tente selecioná-la novamente." };
    }
    if (/^\s*</.test(body)) {
      return { error: `O servidor interrompeu o upload antes de responder (${response.status}). Tente novamente ou verifique o limite de upload do proxy.` };
    }
    return { error: `O servidor retornou uma resposta inválida durante o upload (${response.status}).` };
  }
}

function validateSelectedImage(file: File, variant: BrowserImageVariant) {
  const accepted = variant === "favicon"
    ? ["image/x-icon", "image/vnd.microsoft.icon", "image/png", "image/jpeg", "image/webp", ""]
    : ["image/png", "image/jpeg", "image/webp", ""];
  if (!accepted.includes(file.type)) throw new Error("Selecione uma imagem PNG, JPEG ou WebP válida.");
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem deve ter entre 1 byte e 5 MB.");
}

async function prepareImage(file: File, variant: BrowserImageVariant) {
  if (variant === "favicon" && /icon/i.test(file.type)) return file;
  if (variant !== "share" && file.size <= PROXY_SAFE_BYTES) return file;

  const image = await loadBrowserImage(file);
  try {
    const dimensions = outputDimensions(image.naturalWidth, image.naturalHeight, variant);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Este navegador não conseguiu preparar a imagem para envio.");

    if (variant === "share") {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(context, image, canvas.width, canvas.height);
    } else {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58];
    let blob: Blob | null = null;
    for (const quality of qualities) {
      blob = await canvasBlob(canvas, "image/webp", quality);
      if (blob && blob.size <= PROXY_SAFE_BYTES) break;
    }
    if (!blob || blob.size > PROXY_SAFE_BYTES) {
      throw new Error("Não foi possível reduzir a imagem para o tamanho aceito pelo servidor. Tente exportá-la com menos de 1 MB.");
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

function outputDimensions(width: number, height: number, variant: BrowserImageVariant) {
  if (variant === "share") return { width: 1200, height: 630 };
  const maximum = variant === "favicon" ? 512 : variant === "photo" ? 1200 : 1600;
  const scale = Math.min(1, maximum / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale, sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2, sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function loadBrowserImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(), objectUrl = URL.createObjectURL(file);
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível abrir a imagem selecionada."));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
}
