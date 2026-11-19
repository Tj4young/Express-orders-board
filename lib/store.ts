import "server-only";

import { randomUUID } from "crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";

import {
  addExampleOrder,
  BoardError,
  createOrder,
  createRecruiter,
  deleteOrder,
  deleteRecruiter,
  fillOrder,
  normalizeState,
  parseOrderInput,
  parseRecruiterInput,
  updateOrder,
  updateRecruiter,
  type Clock,
} from "./board";
import type { BoardState, MutationResult } from "./types";

const STATE_KEY = "express-orders-board:v1";
const LOCK_KEY = "express-orders-board:lock";

export type BoardRepository = {
  kind: "redis" | "file";
  read(): Promise<BoardState>;
  createOrder(body: unknown): Promise<MutationResult>;
  updateOrder(id: string, body: unknown): Promise<MutationResult>;
  deleteOrder(id: string): Promise<BoardState>;
  fill(id: string, action: "increment" | "undo", recruiterId?: string): Promise<MutationResult>;
  createRecruiter(body: unknown): Promise<BoardState>;
  updateRecruiter(id: string, body: unknown): Promise<BoardState>;
  deleteRecruiter(id: string): Promise<BoardState>;
  addExample(): Promise<BoardState>;
};

function clock(): Clock {
  return { now: new Date(), id: () => randomUUID() };
}

async function mutate<T>(
  read: () => Promise<BoardState>,
  write: (state: BoardState) => Promise<void>,
  change: (state: BoardState, now: Clock) => T,
): Promise<T> {
  const current = await read();
  const now = clock();
  const result = change(current, now);
  await write(isMutation(result) ? result.state : (result as BoardState));
  return result;
}

function isMutation(value: unknown): value is MutationResult {
  return Boolean(value && typeof value === "object" && "celebration" in value && "state" in value);
}

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand(env: { url: string; token: string }, args: (string | number)[]): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(env.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map((part) => String(part))),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new BoardError("The shared board database didn't respond. Try again in a moment.", 503);
  }
  if (!response.ok) {
    throw new BoardError("The shared board database didn't respond. Try again in a moment.", 503);
  }
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error) {
    throw new BoardError("The shared board database rejected the update. Try again.", 503);
  }
  return payload.result;
}

function createRedisRepository(env: { url: string; token: string }): BoardRepository {
  const read = async (): Promise<BoardState> => {
    const result = await redisCommand(env, ["GET", STATE_KEY]);
    if (typeof result !== "string" || !result) return normalizeState(null);
    try {
      return normalizeState(JSON.parse(result));
    } catch {
      return normalizeState(null);
    }
  };

  const write = async (state: BoardState) => {
    await redisCommand(env, ["SET", STATE_KEY, JSON.stringify(state)]);
  };

  const locked = async <T>(change: (state: BoardState, now: Clock) => T): Promise<T> => {
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const result = await redisCommand(env, ["SET", LOCK_KEY, token, "NX", "PX", 4000]);
      if (result === "OK") {
        acquired = true;
        break;
      }
      await delay(40 + attempt * 20);
    }
    if (!acquired) throw new BoardError("Someone else just updated the board. Try that again.", 409);
    try {
      return await mutate(read, write, change);
    } finally {
      await redisCommand(env, [
        "EVAL",
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        LOCK_KEY,
        token,
      ]).catch(() => undefined);
    }
  };

  return repository("redis", read, locked);
}

async function withFileLock<T>(filePath: string, change: () => Promise<T>): Promise<T> {
  const lockPath = `${filePath}.lock`;
  await mkdir(path.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      try {
        return await change();
      } finally {
        await rm(lockPath, { force: true });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 8000) {
        await rm(lockPath, { force: true });
        continue;
      }
      await delay(25 + attempt * 15);
    }
  }
  throw new BoardError("The board is busy. Try again.", 409);
}

export function createFileRepository(filePath: string): BoardRepository {
  const read = async (): Promise<BoardState> => {
    try {
      const raw = await readFile(filePath, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return normalizeState(null);
      throw error;
    }
  };

  const write = async (state: BoardState) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state), "utf8");
    await rename(temporary, filePath);
  };

  const locked = <T,>(change: (state: BoardState, now: Clock) => T) =>
    withFileLock(filePath, () => mutate(read, write, change));

  return repository("file", read, locked);
}

function repository(
  kind: BoardRepository["kind"],
  read: () => Promise<BoardState>,
  locked: <T>(change: (state: BoardState, now: Clock) => T) => Promise<T>,
): BoardRepository {
  return {
    kind,
    read,
    createOrder: (body) =>
      locked((state, now) => createOrder(state, parseOrderInput(body, state.recruiters, now.now), now)),
    updateOrder: (id, body) =>
      locked((state, now) => updateOrder(state, id, parseOrderInput(body, state.recruiters, now.now), now)),
    deleteOrder: (id) => locked((state, now) => deleteOrder(state, id, now)),
    fill: (id, action, recruiterId) => locked((state, now) => fillOrder(state, id, action, now, recruiterId)),
    createRecruiter: (body) => locked((state, now) => createRecruiter(state, parseRecruiterInput(body), now)),
    updateRecruiter: (id, body) =>
      locked((state, now) => updateRecruiter(state, id, parseRecruiterInput(body), now)),
    deleteRecruiter: (id) => locked((state, now) => deleteRecruiter(state, id, now)),
    addExample: () => locked((state, now) => addExampleOrder(state, now)),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let singleton: BoardRepository | null = null;

export function boardFilePath(): string {
  return path.join(process.cwd(), "data", "board.json");
}

export function getRepository(): BoardRepository {
  if (singleton) return singleton;
  const env = redisEnv();
  if (env) {
    singleton = createRedisRepository(env);
    return singleton;
  }
  if (process.env.VERCEL) {
    throw new BoardError(
      "This deployment has no shared database yet. In Vercel, add Upstash Redis, connect it to the project, then redeploy.",
      503,
    );
  }
  singleton = createFileRepository(boardFilePath());
  return singleton;
}

/** Test helper so a file repository isn't reused across cases. */
export function resetRepositoryForTests() {
  singleton = null;
}
