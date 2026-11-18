import type { OfficeId } from "./types";

export const OFFICES: Record<
  OfficeId,
  { id: OfficeId; name: string; short: string; city: string }
> = {
  tempe: {
    id: "tempe",
    name: "Express Tempe",
    short: "Tempe",
    city: "Tempe, AZ",
  },
  mesa: {
    id: "mesa",
    name: "Express Mesa",
    short: "Mesa",
    city: "Mesa, AZ",
  },
};

export const OFFICE_IDS: OfficeId[] = ["tempe", "mesa"];

export function officeName(office: OfficeId): string {
  return OFFICES[office].name;
}

export const SHIFT_SUGGESTIONS = [
  "1st Shift",
  "2nd Shift",
  "3rd Shift",
  "Days",
  "Nights",
  "Swing",
  "Weekends",
];
