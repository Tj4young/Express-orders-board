export type OfficeId = "tempe" | "mesa";

export type Recruiter = {
  id: string;
  name: string;
  office: OfficeId;
};

export type Order = {
  id: string;
  office: OfficeId;
  client: string;
  position: string;
  payRate: string;
  shift: string;
  openings: number;
  filled: number;
  /** Who opened the order. Each placement is credited on its own fill. */
  recruiterId: string;
  /** Calendar date the order was opened, YYYY-MM-DD in the office's terms. */
  dateOpened: string;
  /** ISO timestamp when filled first reached openings. Null while the order is active. */
  dateFilled: string | null;
  notes: string;
  /** True only for the optional labeled sample. Never seeded on its own. */
  example: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * One person placed. `recruiterId` is who placed them.
 * `office` is that recruiter's office at the time, so a later office change
 * does not move the head. Undo deletes this record.
 */
export type FillEvent = {
  id: string;
  orderId: string;
  office: OfficeId;
  recruiterId: string;
  at: string;
};

export type Celebration = {
  id: string;
  orderId: string;
  office: OfficeId;
  officeName: string;
  client: string;
  position: string;
  /** Order owner, the person who opened it. */
  recruiterName: string;
  /** Everyone who placed at least one person, in the order they first did. */
  contributors?: string[];
  at: string;
};

export type BoardState = {
  /** 2 means each fill is already credited to the person who placed it. */
  schemaVersion: number;
  recruiters: Recruiter[];
  orders: Order[];
  fillEvents: FillEvent[];
  celebrations: Celebration[];
  updatedAt: string;
};

export type OrderInput = {
  office: OfficeId;
  client: string;
  position: string;
  payRate: string;
  shift: string;
  openings: number;
  filled: number;
  recruiterId: string;
  dateOpened: string;
  notes: string;
};

export type RecruiterInput = {
  name: string;
  office: OfficeId;
};

export type MutationResult = {
  state: BoardState;
  celebration: Celebration | null;
};
