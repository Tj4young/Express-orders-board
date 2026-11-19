const MAX_EDGE = 256;
const MAX_CHARS = 70_000;

export async function fileToLogo(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/svg+xml" || name.endsWith(".svg")) return svgToLogo(file);
  const image = await loadImage(file);
  return rasterToLogo(image);
}

async function svgToLogo(file: File): Promise<string> {
  const text = await file.text();
  if (text.length > 48_000) {
    throw new Error("That SVG is too large. Export a simpler file or use a PNG.");
  }
  if (/<script|javascript:|onload=/i.test(text)) {
    throw new Error("That SVG isn't allowed. Export it as a plain logo.");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo. Use a PNG, JPG, WebP, or SVG."));
    };
    image.src = url;
  });
}

function rasterToLogo(image: HTMLImageElement): string {
  let edge = MAX_EDGE;
  let quality = 0.86;
  let encoded = encode(image, edge, quality);
  while (encoded.length > MAX_CHARS && (quality > 0.5 || edge > 96)) {
    if (quality > 0.5) quality = Math.round((quality - 0.12) * 100) / 100;
    else edge = Math.round(edge * 0.8);
    encoded = encode(image, edge, quality);
  }
  if (encoded.length > MAX_CHARS) {
    throw new Error("That photo is still too large after compressing. Try a simpler image.");
  }
  return encoded;
}

function encode(image: HTMLImageElement, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser couldn't prepare that photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", quality);
}
