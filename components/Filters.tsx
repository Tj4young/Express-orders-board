"use client";

import type { SortKey } from "@/lib/filters";
import type { OfficeId, Recruiter } from "@/lib/types";

export function Filters({
  tone = "light",
  showOffice = false,
  office,
  recruiterId,
  shift,
  sort,
  recruiters,
  shifts,
  onOffice,
  onRecruiter,
  onShift,
  onSort,
  oldestLabel = "Oldest first",
}: {
  tone?: "light" | "dark";
  showOffice?: boolean;
  office: OfficeId | "all";
  recruiterId: string;
  shift: string;
  sort: SortKey;
  recruiters: Recruiter[];
  shifts: string[];
  onOffice: (office: OfficeId | "all") => void;
  onRecruiter: (id: string) => void;
  onShift: (shift: string) => void;
  onSort: (sort: SortKey) => void;
  oldestLabel?: string;
}) {
  return (
    <div className={tone === "dark" ? "filters filters-dark" : "filters"}>
      {showOffice && (
        <label>
          Office
          <select value={office} onChange={(event) => onOffice(event.target.value as OfficeId | "all")}>
            <option value="all">Both offices</option>
            <option value="tempe">Express Tempe</option>
            <option value="mesa">Express Mesa</option>
          </select>
        </label>
      )}
      <label>
        Recruiter
        <select value={recruiterId} onChange={(event) => onRecruiter(event.target.value)}>
          <option value="all">Everyone</option>
          {recruiters.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Shift
        <select value={shift} onChange={(event) => onShift(event.target.value)}>
          <option value="all">All shifts</option>
          {shifts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
          <option value="oldest">{oldestLabel}</option>
          <option value="openings">Most openings</option>
        </select>
      </label>
    </div>
  );
}
