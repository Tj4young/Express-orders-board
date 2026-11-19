const MAX_LOGO_CHARS = 70_000;

const LOGO_PATTERN = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

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

export function isSafeLogo(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const compact = value.replace(/\s/g, "");
  if (compact.length === 0 || compact.length > MAX_LOGO_CHARS) return false;
  if (!LOGO_PATTERN.test(compact)) return false;
  if (compact.toLowerCase().startsWith("data:image/svg+xml")) {
    const payload = compact.slice(compact.indexOf(",") + 1);
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

/** Null when omitted. Throws when the value is present but not a small image. */
export function sanitizeLogo(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!isSafeLogo(value)) {
    throw new Error("Use a PNG, JPG, WebP, or SVG logo under about 50KB.");
  }
  return value.replace(/\s/g, "");
}
