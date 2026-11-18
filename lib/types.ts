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

/** One person placed. Undoing a fill removes the event so the score stays honest. */
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
  recruiterName: string;
  at: string;
};

export type BoardState = {
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
