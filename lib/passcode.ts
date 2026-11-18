import { timingSafeEqual } from "crypto";

export function passcodeMatches(given: string | null | undefined, expected: string): boolean {
  const left = Buffer.from(given ?? "");
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}
