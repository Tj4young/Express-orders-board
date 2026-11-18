import type { Recruiter } from "./types";

/**
 * Real desk names, not sample orders. Offices are a starting assignment
 * the team can change in the Recruiters editor.
 * Tempe: Ivonne, Isabella, Jane. Mesa: Alex, Tim.
 */
export const DEFAULT_RECRUITERS: Recruiter[] = [
  { id: "rec_ivonne", name: "Ivonne", office: "tempe" },
  { id: "rec_isabella", name: "Isabella", office: "tempe" },
  { id: "rec_jane", name: "Jane", office: "tempe" },
  { id: "rec_alex", name: "Alex", office: "mesa" },
  { id: "rec_tim", name: "Tim", office: "mesa" },
];
