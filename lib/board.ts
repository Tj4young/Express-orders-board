import { contributorIds, recruiterDisplayName } from "./credit";
import { isSafeLogo, sanitizeLogo } from "./logo";
import { DEFAULT_RECRUITERS } from "./defaults";
import { officeName } from "./offices";
import { formatPhoenixISODate, isValidISODate } from "./time";
import type {
  BoardState,
  Celebration,
  FillEvent,
  MutationResult,
  OfficeId,
  Order,
  OrderInput,
  Recruiter,
  RecruiterInput,
} from "./types";

const MAX_FILL_EVENTS = 5000;
const MAX_CELEBRATIONS = 40;

export class BoardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BoardError";
    this.status = status;
  }
}

export type Clock = {
  now: Date;
  id: () => string;
};

export function createInitialState(now = new Date()): BoardState {
  return {
    schemaVersion: 2,
    recruiters: DEFAULT_RECRUITERS.map((recruiter) => ({ ...recruiter })),
    orders: [],
    fillEvents: [],
    celebrations: [],
    updatedAt: now.toISOString(),
  };
}

function text(value: unknown, label: string, max: number, required: boolean): string {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new BoardError(`Enter a ${label.toLowerCase()}.`);
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    if (!required) return "";
    throw new BoardError(`Enter a ${label.toLowerCase()}.`);
  }
  if (trimmed.length > max) {
    throw new BoardError(`${label} needs to be ${max} characters or fewer.`);
  }
  return trimmed;
}

function wholeNumber(value: unknown, label: string, min: number, max: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new BoardError(`${label} needs to be a whole number from ${min} to ${max}.`);
  }
  return number;
}

export function parseOrderInput(body: unknown, recruiters: Recruiter[], now: Date): OrderInput {
  if (!body || typeof body !== "object") throw new BoardError("Missing order details.");
  const raw = body as Record<string, unknown>;
  const office = raw.office;
  if (office !== "tempe" && office !== "mesa") throw new BoardError("Choose Tempe or Mesa.");
  const openings = wholeNumber(raw.openings, "Openings", 1, 500);
  const filled = wholeNumber(raw.filled, "Filled", 0, openings);
  const recruiterId = text(raw.recruiterId, "Recruiter", 80, true);
  if (!recruiters.some((recruiter) => recruiter.id === recruiterId)) {
    throw new BoardError("Choose a recruiter from the list.");
  }
  const dateOpened = text(raw.dateOpened, "Date opened", 10, true);
  if (!isValidISODate(dateOpened)) throw new BoardError("Enter a valid date opened.");
  const today = formatPhoenixISODate(now);
  if (dateOpened > today) throw new BoardError("Date opened can't be in the future.");
  let logo: string | null = null;
  try {
    logo = sanitizeLogo(raw.logo);
  } catch (error) {
    throw new BoardError(error instanceof Error ? error.message : "Use a PNG, JPG, WebP, or SVG logo.");
  }
  return {
    office,
    client: text(raw.client, "Client", 80, true),
    position: text(raw.position, "Position", 80, true),
    payRate: text(raw.payRate, "Pay rate", 40, true),
    shift: text(raw.shift, "Shift", 40, true),
    openings,
    filled,
    recruiterId,
    dateOpened,
    notes: text(raw.notes, "Notes", 500, false),
    logo,
  };
}

export function parseRecruiterInput(body: unknown): RecruiterInput {
  if (!body || typeof body !== "object") throw new BoardError("Missing recruiter details.");
  const raw = body as Record<string, unknown>;
  const office = raw.office;
  if (office !== "tempe" && office !== "mesa") throw new BoardError("Choose Tempe or Mesa.");
  const name = text(raw.name, "Name", 40, true);
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name)) {
    throw new BoardError("Use a name with letters, spaces, apostrophes, or hyphens.");
  }
  return { name, office };
}

function contributorNames(state: BoardState, orderId: string): string[] {
  return contributorIds(state, orderId).map((recruiterId) => recruiterDisplayName(state, recruiterId));
}

function celebrationBase(order: Order, state: BoardState, now: Date, id: () => string): Celebration {
  return {
    id: id(),
    orderId: order.id,
    office: order.office,
    officeName: officeName(order.office),
    client: order.client,
    position: order.position,
    recruiterName: recruiterDisplayName(state, order.recruiterId),
    contributors: contributorNames(state, order.id),
    at: now.toISOString(),
    filled: order.filled,
    openings: order.openings,
  };
}

function refreshCelebrations(state: BoardState, order: Order) {
  const names = contributorNames(state, order.id);
  for (const item of state.celebrations) {
    if (item.orderId !== order.id) continue;
    item.office = order.office;
    item.officeName = officeName(order.office);
    item.client = order.client;
    item.position = order.position;
    item.recruiterName = recruiterDisplayName(state, order.recruiterId);
    item.contributors = names;
    item.openings = order.openings;
    if (item.placedById) item.placedBy = recruiterDisplayName(state, item.placedById);
  }
}

/** Drop celebrations that describe a fill count or a completion the order no longer has. */
function dropStaleCelebrations(state: BoardState, order: Order) {
  const complete = order.filled >= order.openings;
  state.celebrations = state.celebrations.filter((item) => {
    if (item.orderId !== order.id) return true;
    if (item.kind !== "fill") return complete;
    return typeof item.filled !== "number" || item.filled <= order.filled;
  });
}

function pushFillCelebration(
  state: BoardState,
  order: Order,
  recruiterId: string,
  added: number,
  now: Date,
  id: () => string,
): Celebration {
  const celebration: Celebration = {
    ...celebrationBase(order, state, now, id),
    kind: "fill",
    added,
    placedById: recruiterId,
    placedBy: recruiterDisplayName(state, recruiterId),
  };
  state.celebrations.push(celebration);
  return celebration;
}

function pushFilledCelebration(state: BoardState, order: Order, now: Date, id: () => string): Celebration {
  const celebration: Celebration = {
    ...celebrationBase(order, state, now, id),
    kind: "filled",
  };
  state.celebrations.push(celebration);
  return celebration;
}

/**
 * One celebration per mutation. A fill that closes the order gets the order-filled
 * celebration. Any other new fills share a single placement celebration. Undo never
 * arrives here with added fills.
 */
function settleCelebrations(
  state: BoardState,
  order: Order,
  wasComplete: boolean,
  now: Date,
  id: () => string,
  added: { recruiterId: string; count: number } | null,
): Celebration | null {
  const complete = order.filled >= order.openings;
  if (complete && !wasComplete) order.dateFilled = now.toISOString();
  else if (!complete) order.dateFilled = null;

  dropStaleCelebrations(state, order);
  refreshCelebrations(state, order);

  if (complete && !wasComplete) return pushFilledCelebration(state, order, now, id);
  if (added && added.count > 0) return pushFillCelebration(state, order, added.recruiterId, added.count, now, id);
  return null;
}

function pushFill(state: BoardState, order: Order, recruiterId: string, now: Date, id: () => string) {
  const recruiter = state.recruiters.find((person) => person.id === recruiterId);
  if (!recruiter) throw new BoardError("Choose a recruiter from the list.");
  const event: FillEvent = {
    id: id(),
    orderId: order.id,
    office: recruiter.office,
    recruiterId: recruiter.id,
    at: now.toISOString(),
  };
  state.fillEvents.push(event);
}

/** Returns how many fill events were added. Removals return 0. */
function syncFills(state: BoardState, order: Order, now: Date, id: () => string): number {
  const current = state.fillEvents.filter((event) => event.orderId === order.id).length;
  if (order.filled > current) {
    const added = order.filled - current;
    for (let i = 0; i < added; i += 1) pushFill(state, order, order.recruiterId, now, id);
    return added;
  }
  if (order.filled < current) {
    let extra = current - order.filled;
    for (let i = state.fillEvents.length - 1; i >= 0 && extra > 0; i -= 1) {
      if (state.fillEvents[i].orderId === order.id) {
        state.fillEvents.splice(i, 1);
        extra -= 1;
      }
    }
  }
  return 0;
}

function trim(state: BoardState) {
  if (state.fillEvents.length > MAX_FILL_EVENTS) {
    state.fillEvents = state.fillEvents.slice(state.fillEvents.length - MAX_FILL_EVENTS);
  }
  if (state.celebrations.length > MAX_CELEBRATIONS) {
    state.celebrations = state.celebrations.slice(state.celebrations.length - MAX_CELEBRATIONS);
  }
}

function touch(state: BoardState, now: Date) {
  trim(state);
  state.updatedAt = now.toISOString();
}

export function createOrder(state: BoardState, input: OrderInput, clock: Clock): MutationResult {
  const next = structuredClone(state);
  const order: Order = {
    id: clock.id(),
    ...input,
    dateFilled: null,
    example: false,
    createdAt: clock.now.toISOString(),
    updatedAt: clock.now.toISOString(),
  };
  next.orders.push(order);
  const added = syncFills(next, order, clock.now, clock.id);
  const celebration = settleCelebrations(
    next,
    order,
    false,
    clock.now,
    clock.id,
    added > 0 ? { recruiterId: order.recruiterId, count: added } : null,
  );
  touch(next, clock.now);
  return { state: next, celebration };
}

export function updateOrder(state: BoardState, orderId: string, input: OrderInput, clock: Clock): MutationResult {
  const next = structuredClone(state);
  const order = next.orders.find((item) => item.id === orderId);
  if (!order) throw new BoardError("That order is no longer on the board.", 404);
  const wasComplete = Boolean(order.dateFilled);
  order.office = input.office;
  order.client = input.client;
  order.position = input.position;
  order.payRate = input.payRate;
  order.shift = input.shift;
  order.openings = input.openings;
  order.filled = input.filled;
  order.recruiterId = input.recruiterId;
  order.dateOpened = input.dateOpened;
  order.notes = input.notes;
  order.logo = input.logo;
  order.updatedAt = clock.now.toISOString();
  const added = syncFills(next, order, clock.now, clock.id);
  const celebration = settleCelebrations(
    next,
    order,
    wasComplete,
    clock.now,
    clock.id,
    added > 0 ? { recruiterId: order.recruiterId, count: added } : null,
  );
  touch(next, clock.now);
  return { state: next, celebration };
}

export function deleteOrder(state: BoardState, orderId: string, clock: Clock): BoardState {
  const next = structuredClone(state);
  if (!next.orders.some((order) => order.id === orderId)) {
    throw new BoardError("That order is no longer on the board.", 404);
  }
  next.orders = next.orders.filter((order) => order.id !== orderId);
  next.fillEvents = next.fillEvents.filter((event) => event.orderId !== orderId);
  next.celebrations = next.celebrations.filter((item) => item.orderId !== orderId);
  touch(next, clock.now);
  return next;
}

export function fillOrder(
  state: BoardState,
  orderId: string,
  action: "increment" | "undo",
  clock: Clock,
  placedBy?: string,
): MutationResult {
  const next = structuredClone(state);
  const order = next.orders.find((item) => item.id === orderId);
  if (!order) throw new BoardError("That order is no longer on the board.", 404);

  if (action === "increment") {
    if (order.filled >= order.openings) throw new BoardError("That order is already filled.");
    const wasComplete = Boolean(order.dateFilled);
    order.filled += 1;
    order.updatedAt = clock.now.toISOString();
    const recruiterId = placedBy ?? order.recruiterId;
    pushFill(next, order, recruiterId, clock.now, clock.id);
    const celebration = settleCelebrations(next, order, wasComplete, clock.now, clock.id, {
      recruiterId,
      count: 1,
    });
    touch(next, clock.now);
    return { state: next, celebration };
  }

  if (order.filled <= 0) throw new BoardError("Nothing to undo on that order.");
  order.filled -= 1;
  order.updatedAt = clock.now.toISOString();
  for (let i = next.fillEvents.length - 1; i >= 0; i -= 1) {
    if (next.fillEvents[i].orderId === order.id) {
      next.fillEvents.splice(i, 1);
      break;
    }
  }
  if (order.filled < order.openings) order.dateFilled = null;
  dropStaleCelebrations(next, order);
  refreshCelebrations(next, order);
  touch(next, clock.now);
  return { state: next, celebration: null };
}

export function createRecruiter(state: BoardState, input: RecruiterInput, clock: Clock): BoardState {
  const next = structuredClone(state);
  const nameTaken = next.recruiters.some((recruiter) => recruiter.name.toLowerCase() === input.name.toLowerCase());
  if (nameTaken) throw new BoardError(`${input.name} is already on the list.`);
  next.recruiters.push({ id: `rec_${clock.id()}`, name: input.name, office: input.office });
  touch(next, clock.now);
  return next;
}

export function updateRecruiter(
  state: BoardState,
  recruiterId: string,
  input: RecruiterInput,
  clock: Clock,
): BoardState {
  const next = structuredClone(state);
  const recruiter = next.recruiters.find((item) => item.id === recruiterId);
  if (!recruiter) throw new BoardError("That recruiter is no longer on the list.", 404);
  const nameTaken = next.recruiters.some(
    (item) => item.id !== recruiterId && item.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (nameTaken) throw new BoardError(`${input.name} is already on the list.`);
  recruiter.name = input.name;
  recruiter.office = input.office;
  for (const item of next.celebrations) {
    if (item.orderId && next.orders.some((order) => order.id === item.orderId && order.recruiterId === recruiterId)) {
      item.recruiterName = input.name;
    }
    if (item.placedById === recruiterId) item.placedBy = input.name;
    if (item.contributors?.length) {
      const ids = contributorIds(next, item.orderId);
      if (ids.includes(recruiterId)) {
        item.contributors = ids.map((personId) => recruiterDisplayName(next, personId));
      }
    }
  }
  touch(next, clock.now);
  return next;
}

export function deleteRecruiter(state: BoardState, recruiterId: string, clock: Clock): BoardState {
  const next = structuredClone(state);
  if (!next.recruiters.some((recruiter) => recruiter.id === recruiterId)) {
    throw new BoardError("That recruiter is no longer on the list.", 404);
  }
  if (next.recruiters.length <= 1) throw new BoardError("Keep at least one recruiter on the list.");
  if (next.orders.some((order) => order.recruiterId === recruiterId)) {
    throw new BoardError("This recruiter still has orders. Reassign those orders first.");
  }
  if (next.fillEvents.some((event) => event.recruiterId === recruiterId)) {
    throw new BoardError("This recruiter has placements on the board. Keep them on the list so those heads stay with their name.");
  }
  next.recruiters = next.recruiters.filter((recruiter) => recruiter.id !== recruiterId);
  touch(next, clock.now);
  return next;
}

export function addExampleOrder(state: BoardState, clock: Clock): BoardState {
  if (state.orders.some((order) => order.example)) {
    throw new BoardError("The example order is already on the board. Delete it before adding another.");
  }
  const recruiter =
    state.recruiters.find((item) => item.id === "rec_ivonne") ??
    state.recruiters.find((item) => item.office === "tempe") ??
    state.recruiters[0];
  if (!recruiter) throw new BoardError("Add a recruiter before creating the example order.");
  const created = createOrder(
    state,
    {
      office: recruiter.office,
      client: "EXAMPLE — Demo Client",
      position: "Forklift Operator",
      payRate: "$19.00/hr",
      shift: "1st Shift",
      openings: 2,
      filled: 0,
      recruiterId: recruiter.id,
      dateOpened: formatPhoenixISODate(clock.now),
      notes: "Example only. This is not a real order — delete it anytime.",
      logo: null,
    },
    clock,
  );
  const order = created.state.orders[created.state.orders.length - 1];
  if (order) order.example = true;
  return created.state;
}

export function normalizeState(value: unknown): BoardState {
  if (!value || typeof value !== "object") return createInitialState();
  const raw = value as Partial<BoardState>;
  const base = createInitialState();
  const recruiters = Array.isArray(raw.recruiters) && raw.recruiters.length > 0 ? raw.recruiters : base.recruiters;
  const orders = (Array.isArray(raw.orders) ? raw.orders : []).map((order) => ({
    ...order,
    logo: isSafeLogo(order.logo) ? order.logo : null,
  }));
  let fillEvents = Array.isArray(raw.fillEvents) ? raw.fillEvents : [];
  if (raw.schemaVersion !== 2) {
    fillEvents = fillEvents.map((event) => {
      const order = orders.find((item) => item.id === event.orderId);
      if (!order) return event;
      const owner = recruiters.find((person) => person.id === order.recruiterId);
      return {
        ...event,
        recruiterId: order.recruiterId,
        office: owner?.office ?? (event.office === "mesa" || event.office === "tempe" ? event.office : order.office),
      };
    });
  }
  return {
    schemaVersion: 2,
    recruiters,
    orders,
    fillEvents,
    celebrations: Array.isArray(raw.celebrations) ? raw.celebrations : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

export function isOfficeId(value: string): value is OfficeId {
  return value === "tempe" || value === "mesa";
}
