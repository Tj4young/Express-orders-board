/** Decoded image bytes, after the browser has resized. About 300KB. */
export const MAX_LOGO_BYTES = 300 * 1024;

const DATA_URL_PREFIX =
  /^data:image\/(png|jpe?g|webp|svg\+xml)(?:;charset=[^;,]+)?;base64,/i;

export function formatKb(bytes: number): string {
  const kb = bytes / 1024;
  const rounded = kb >= 100 ? Math.round(kb) : Math.round(kb * 10) / 10;
  return `${rounded} KB`;
}

export function logoLimitMessage(bytes: number): string {
  return `This logo is ${formatKb(bytes)}. The limit is ${formatKb(MAX_LOGO_BYTES)}.`;
}

/** Byte length of the image inside a data URL, not the length of the base64 text. */
export function logoBytes(value: string): number {
  const comma = value.indexOf(",");
  if (comma < 0) return 0;
  const payload = value.slice(comma + 1).replace(/\s/g, "");
  if (!payload) return 0;
  const binary = atob(payload);
  return binary.length;
}

export function clientInitials(client: string): string {
  const words = client
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function imagePrefix(value: string): string | null {
  const match = DATA_URL_PREFIX.exec(value);
  return match ? match[0] : null;
}

export function isSafeLogo(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const compact = value.replace(/\s/g, "");
  const prefix = imagePrefix(compact);
  if (!prefix) return false;
  const payload = compact.slice(prefix.length);
  if (!/^[a-z0-9+/_-]+={0,2}$/i.test(payload)) return false;
  let bytes = 0;
  try {
    bytes = logoBytes(compact);
  } catch {
    return false;
  }
  if (bytes <= 0 || bytes > MAX_LOGO_BYTES) return false;
  if (compact.toLowerCase().startsWith("data:image/svg+xml")) {
    let decoded = "";
    try {
      decoded = atob(payload).toLowerCase();
    } catch {
      return false;
    }
    if (decoded.includes("<script") || decoded.includes("javascript:") || decoded.includes("onload=")) return false;
  }
  return true;
}

/** Null when omitted. Throws when the value is present but not a usable image. */
export function sanitizeLogo(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const compact = value.replace(/\s/g, "");
    if (imagePrefix(compact)) {
      try {
        const bytes = logoBytes(compact);
        if (bytes > MAX_LOGO_BYTES) throw new Error(logoLimitMessage(bytes));
      } catch (error) {
        if (error instanceof Error && error.message.includes("The limit is")) throw error;
      }
    }
  }
  if (!isSafeLogo(value)) {
    throw new Error("Use a PNG, JPG, WebP, or SVG logo.");
  }
  return value.replace(/\s/g, "");
}
