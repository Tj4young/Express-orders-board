import type { BoardState } from "./types";

export function contributorIds(state: BoardState, orderId: string): string[] {
  const ids: string[] = [];
  for (const event of state.fillEvents) {
    if (event.orderId === orderId && !ids.includes(event.recruiterId)) ids.push(event.recruiterId);
  }
  return ids;
}

export function recruiterDisplayName(state: BoardState, recruiterId: string): string {
  return state.recruiters.find((recruiter) => recruiter.id === recruiterId)?.name ?? "Team";
}

export function contributorNames(state: BoardState, orderId: string): string[] {
  return contributorIds(state, orderId).map((id) => recruiterDisplayName(state, id));
}

function indefiniteArticle(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

/** "🎉 Ivonne placed a Machine Operator at State Seal! 2 of 5 filled" */
export function fillCelebrationTitle(celebration: {
  placedBy?: string;
  recruiterName: string;
  position: string;
  client: string;
  filled?: number;
  openings?: number;
  added?: number;
}): string {
  const name = celebration.placedBy?.trim() || celebration.recruiterName;
  const filled = celebration.filled ?? 0;
  const openings = celebration.openings ?? filled;
  const added = celebration.added && celebration.added > 1 ? celebration.added : 1;
  const placement =
    added > 1
      ? `${name} placed ${added} people as ${celebration.position} at ${celebration.client}`
      : `${name} placed ${indefiniteArticle(celebration.position)} ${celebration.position} at ${celebration.client}`;
  return `🎉 ${placement}! ${filled} of ${openings} filled`;
}

/** "Ivonne", "Ivonne and Jane", "Ivonne, Jane, and Alex". */
export function formatNameList(names: string[]): string {
  if (names.length === 0) return "Team";
  if (names.length === 1) return names[0] ?? "Team";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** "Ivonne 2 · Jane 2" in the order each person first placed someone. */
export function placementBreakdown(state: BoardState, orderId: string): string {
  const counts = new Map<string, number>();
  for (const event of state.fillEvents) {
    if (event.orderId !== orderId) continue;
    counts.set(event.recruiterId, (counts.get(event.recruiterId) ?? 0) + 1);
  }
  return contributorIds(state, orderId)
    .map((id) => `${recruiterDisplayName(state, id)} ${counts.get(id) ?? 0}`)
    .join(" · ");
}
