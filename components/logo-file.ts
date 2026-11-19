import { logoBytes, logoLimitMessage, MAX_LOGO_BYTES } from "@/lib/logo";

const MAX_EDGE = 512;

export async function fileToLogo(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/svg+xml" || name.endsWith(".svg")) return svgToLogo(file);
  if (isHeic(type, name)) return heicToLogo(file);
  const embedded = await embedWhenAlreadySmall(file);
  if (embedded) return embedded;
  return rasterFileToLogo(file);
}

function isHeic(type: string, name: string): boolean {
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

async function heicToLogo(file: File): Promise<string> {
  try {
    return await rasterFileToLogo(file);
  } catch {
    throw new Error("This is an iPhone HEIC photo. Save it as a JPEG, then upload that.");
  }
}

async function svgToLogo(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_LOGO_BYTES) {
    throw new Error(logoLimitMessage(bytes.length));
  }
  const text = new TextDecoder().decode(bytes);
  if (/<script|javascript:|onload=/i.test(text)) {
    throw new Error("That SVG isn't allowed. Export it as a plain logo.");
  }
  return `data:image/svg+xml;base64,${bytesToBase64(bytes)}`;
}

/** A logo that is already under the limit is stored as-is, so a tiny file is never rejected for size. */
async function embedWhenAlreadySmall(file: File): Promise<string | null> {
  if (file.size <= 0 || file.size > MAX_LOGO_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return null;
  const url = `data:${mime};base64,${bytesToBase64(bytes)}`;
  if (logoBytes(url) > MAX_LOGO_BYTES) return null;
  return url;
}

function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

async function rasterFileToLogo(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that photo. Use a PNG, JPG, WebP, or SVG.");
  }
  try {
    if (!bitmap.width || !bitmap.height) {
      throw new Error("Couldn't read that photo. Use a PNG, JPG, WebP, or SVG.");
    }
    return rasterToLogo(bitmap);
  } finally {
    bitmap.close();
  }
}

function rasterToLogo(image: ImageBitmap): string {
  let edge = Math.min(MAX_EDGE, Math.max(image.width, image.height));
  let quality = 0.86;
  let encoded = encode(image, edge, quality);
  while (logoBytes(encoded) > MAX_LOGO_BYTES && (quality > 0.4 || edge > 96)) {
    if (quality > 0.4) quality = Math.round((quality - 0.1) * 100) / 100;
    else {
      edge = Math.round(edge * 0.75);
      quality = 0.8;
    }
    encoded = encode(image, edge, quality);
  }
  const bytes = logoBytes(encoded);
  if (bytes > MAX_LOGO_BYTES) throw new Error(logoLimitMessage(bytes));
  return encoded;
}

function encode(image: ImageBitmap, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser couldn't prepare that photo.");
  context.drawImage(image, 0, 0, width, height);
  const jpeg = canvas.toDataURL("image/jpeg", quality);
  if (jpeg.startsWith("data:image/jpeg") || jpeg.startsWith("data:image/jpg")) return jpeg;
  return canvas.toDataURL("image/png");
}
