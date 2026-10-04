const uploadLimit = 5 * 1024 * 1024;
const sourceLimit = 20 * 1024 * 1024;
export const receiptAccept = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif";
type Converters = { heicToJpeg: (file: Blob) => Promise<Blob>; imageToJpeg: (file: Blob) => Promise<Blob> };

function imageType(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 5) === "%PDF-") return "application/pdf";
  if ([137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (text(0,4) === "RIFF" && text(8,12) === "WEBP") return "image/webp";
  if (text(0,6) === "GIF87a" || text(0,6) === "GIF89a") return "image/gif";
  if (text(0,2) === "BM") return "image/bmp";
  if (text(4,8) === "ftyp") {
    const brand = text(8,12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic","heix","hevc","hevx","mif1","msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const { default: convert } = await import("heic-convert/browser.js");
  const bytes = await convert({ buffer: new Uint8Array(await file.arrayBuffer()), format: "JPEG", quality: 0.92 });
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

async function imageToJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("decode")); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 48_000_000) throw new Error("dimensions");
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    let scale = Math.min(1, 4000 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("encode")), "image/jpeg", 0.92));
      if (result.size <= uploadLimit) return result;
      scale *= 0.75;
    }
    throw new Error("size");
  } finally { URL.revokeObjectURL(url); }
}

/** Keep originals when supported; normalize phone images locally before signed upload. */
export async function prepareReceipt(file: File, converters: Partial<Converters> = {}): Promise<File> {
  if (!file.size || file.size > sourceLimit) throw new Error("Dosya çok büyük. Daha küçük bir dosya seçin.");
  const type = imageType(new Uint8Array(await file.slice(0, 256).arrayBuffer()));
  if (!type) throw new Error("Geçerli bir dekont belgesi veya görseli seçin.");
  if (type === "application/pdf" && file.size > uploadLimit) throw new Error("PDF dosyası çok büyük. Daha küçük bir dosya seçin.");
  if (["application/pdf", "image/png", "image/jpeg"].includes(type) && file.size <= uploadLimit) return new File([file], file.name, { type });
  try {
    let result: Blob = new Blob([file], { type });
    if (type === "image/heic") result = await (converters.heicToJpeg ?? heicToJpeg)(result);
    if (type !== "image/heic" || result.size > uploadLimit) result = await (converters.imageToJpeg ?? imageToJpeg)(result);
    const bytes = new Uint8Array(await result.slice(0, 8).arrayBuffer());
    if (result.size > uploadLimit || imageType(bytes) !== "image/jpeg") throw new Error("output");
    return new File([result], `${file.name.replace(/\.[^.]+$/, "") || "dekont"}.jpg`, { type: "image/jpeg" });
  } catch { throw new Error("Görsel açılamadı. Yeniden seçin veya ekran görüntüsünü yükleyin."); }
}
