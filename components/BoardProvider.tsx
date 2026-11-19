"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { formatKb, logoBytes } from "@/lib/logo";
import type { BoardState, Celebration, OfficeId, Order, OrderInput, RecruiterInput } from "@/lib/types";

import { CelebrationOverlay } from "./CelebrationOverlay";
import { Dialogs } from "./Dialogs";
import { playCelebrationSound, primeCelebrationSound } from "./sound";

const PASSCODE_KEY = "express-orders-passcode";
const SOUND_KEY = "express-orders-sound";
const POLL_MS = 2500;

function assertLogoSaved(input: OrderInput, state: BoardState | undefined) {
  if (!input.logo) return;
  const saved = [...(state?.orders ?? [])]
    .reverse()
    .find((order) => order.client === input.client && order.position === input.position && order.office === input.office);
    if (saved?.logo !== input.logo) {
    const bytes = logoBytes(input.logo);
    throw new Error(`The order saved, but the logo didn't stick. The logo was ${formatKb(bytes)}.`);
  }
}

export type DialogState =
  | { type: "order"; order: Order | null; office: OfficeId }
  | { type: "recruiters" }
  | { type: "place"; order: Order }
  | { type: "unlock" }
  | null;

export type ToastState = { message: string; undoId?: string } | null;

type MutationBody = { state: BoardState; celebration?: Celebration | null };

export type BoardController = {
  state: BoardState | null;
  loading: boolean;
  online: boolean;
  loadError: string | null;
  now: Date | null;
  unlocked: boolean;
  soundOn: boolean;
  dialog: DialogState;
  toast: ToastState;
  celebration: Celebration | null;
  pendingId: string | null;
  setSoundOn: (on: boolean) => void;
  unlock: (passcode: string) => Promise<void>;
  lock: () => void;
  openOrder: (order: Order | null, office: OfficeId) => void;
  openRecruiters: () => void;
  openPlace: (order: Order) => void;
  openUnlock: () => void;
  closeDialog: () => void;
  dismissToast: () => void;
  dismissCelebration: () => void;
  createOrder: (input: OrderInput) => Promise<void>;
  updateOrder: (id: string, input: OrderInput) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  fillOne: (order: Order, recruiterId: string) => Promise<void>;
  undoFill: (id: string) => Promise<void>;
  saveRecruiter: (input: RecruiterInput, id?: string) => Promise<void>;
  deleteRecruiter: (id: string) => Promise<void>;
  addExample: () => Promise<void>;
};

const BoardContext = createContext<BoardController | null>(null);

export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used within BoardProvider");
  return value;
}

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const controller = useBoardController();
  return (
    <BoardContext.Provider value={controller}>
      {children}
      <CelebrationOverlay />
      <Dialogs />
      <Toast />
    </BoardContext.Provider>
  );
}

function Toast() {
  const { toast, dismissToast, undoFill, pendingId } = useBoard();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <p>{toast.message}</p>
      {toast.undoId && (
        <button
          className="btn btn-ghost"
          type="button"
          disabled={pendingId === toast.undoId}
          onClick={() => {
            void undoFill(toast.undoId as string);
            dismissToast();
          }}
        >
          Undo
        </button>
      )}
      <button className="btn btn-ghost icon-btn" type="button" onClick={dismissToast} aria-label="Dismiss notice">
        ×
      </button>
    </div>
  );
}

function useBoardController(): BoardController {
  const [state, setState] = useState<BoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [soundOn, setSoundOnState] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const passcodeRef = useRef("");
  const soundRef = useRef(false);
  const updatedAtRef = useRef("");
  const seenRef = useRef(new Set<string>());
  const primedRef = useRef(false);
  const mutatingRef = useRef(0);
  const queueRef = useRef<Celebration[]>([]);
  const showingRef = useRef(false);
  const intentRef = useRef<DialogState>(null);
  const toastTimer = useRef<number | null>(null);

  const pump = useCallback(() => {
    if (showingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    showingRef.current = true;
    setCelebration(next);
    setToast(null);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (soundRef.current) {
      try {
        playCelebrationSound();
      } catch {
        /* A browser can block sound until the page has been clicked. */
      }
    }
  }, []);

  const enqueue = useCallback(
    (items: Array<Celebration | null | undefined>) => {
      let added = false;
      for (const item of items) {
        if (!item || seenRef.current.has(item.id)) continue;
        seenRef.current.add(item.id);
        queueRef.current.push(item);
        added = true;
      }
      if (added) pump();
    },
    [pump],
  );

  const dismissCelebration = useCallback(() => {
    showingRef.current = false;
    setCelebration(null);
    window.setTimeout(() => pump(), 180);
  }, [pump]);

  const flash = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (!next) return;
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const applyState = useCallback(
    (next: BoardState, ownCelebration: Celebration | null, fromMutation: boolean) => {
      if (!fromMutation && updatedAtRef.current && next.updatedAt < updatedAtRef.current) return;
      updatedAtRef.current = next.updatedAt;
      setState(next);
      if (!primedRef.current) {
        for (const item of next.celebrations) {
          if (ownCelebration && item.id === ownCelebration.id) continue;
          seenRef.current.add(item.id);
        }
        primedRef.current = true;
      }
      if (ownCelebration) enqueue([ownCelebration]);
      else if (primedRef.current) enqueue(next.celebrations);
    },
    [enqueue],
  );

  const pull = useCallback(async () => {
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as BoardState & { error?: string };
      if (!response.ok) throw new Error(body.error || "The board didn't load.");
      if (mutatingRef.current === 0) applyState(body, null, false);
      setOnline(true);
      setLoadError(null);
    } catch (error) {
      setOnline(false);
      setLoadError(error instanceof Error ? error.message : "The board didn't load.");
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    const stored = window.localStorage.getItem(PASSCODE_KEY) ?? "";
    passcodeRef.current = stored;
    const sound = window.localStorage.getItem(SOUND_KEY) === "on";
    soundRef.current = sound;
    setSoundOnState(sound);
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    if (stored) {
      void fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: stored }),
      }).then((response) => {
        if (response.ok) setUnlocked(true);
        else {
          passcodeRef.current = "";
          window.localStorage.removeItem(PASSCODE_KEY);
        }
      });
    }
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    void pull();
    const timer = window.setInterval(() => void pull(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pull]);

  const api = useCallback(async (path: string, init?: RequestInit): Promise<MutationBody> => {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    if (passcodeRef.current) headers.set("x-team-passcode", passcodeRef.current);
    const response = await fetch(path, { ...init, headers, cache: "no-store" });
    const raw = await response.text();
    const requestBytes = typeof init?.body === "string" ? new TextEncoder().encode(init.body).length : 0;
    let body: Partial<MutationBody> & { error?: string } = {};
    try {
      body = raw ? (JSON.parse(raw) as MutationBody & { error?: string }) : {};
    } catch {
      body = {
        error:
          response.status === 413
            ? `The server rejected this save. The request was ${formatKb(requestBytes)} and the request limit is 4.5 MB.`
            : `The save didn't come back in one piece. The request was ${formatKb(requestBytes)}.`,
      };
    }
    if (response.status === 401) {
      passcodeRef.current = "";
      window.localStorage.removeItem(PASSCODE_KEY);
      setUnlocked(false);
      setDialog({ type: "unlock" });
    }
    if (!response.ok || !body.state) throw new Error(body.error || "That didn't save. Try again.");
    return body as MutationBody;
  }, []);

  const mutate = useCallback(
    async (path: string, init: RequestInit | undefined, onOk: (body: MutationBody) => void) => {
      mutatingRef.current += 1;
      try {
        const body = await api(path, init);
        onOk(body);
      } finally {
        mutatingRef.current -= 1;
      }
    },
    [api],
  );

  const setSoundOn = useCallback((on: boolean) => {
    soundRef.current = on;
    setSoundOnState(on);
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    if (on) primeCelebrationSound();
  }, []);

  const unlock = useCallback(async (passcode: string) => {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(body.error || "That passcode didn't match.");
    passcodeRef.current = passcode;
    window.localStorage.setItem(PASSCODE_KEY, passcode);
    setUnlocked(true);
    const next = intentRef.current;
    intentRef.current = null;
    setDialog(next);
  }, []);

  const lock = useCallback(() => {
    passcodeRef.current = "";
    window.localStorage.removeItem(PASSCODE_KEY);
    setUnlocked(false);
    setDialog(null);
  }, []);

  const openOrder = useCallback(
    (order: Order | null, office: OfficeId) => {
      const next: DialogState = { type: "order", order, office };
      if (!passcodeRef.current) {
        intentRef.current = next;
        setDialog({ type: "unlock" });
        return;
      }
      setDialog(next);
    },
    [],
  );

  const openRecruiters = useCallback(() => {
    if (!passcodeRef.current) {
      intentRef.current = { type: "recruiters" };
      setDialog({ type: "unlock" });
      return;
    }
    setDialog({ type: "recruiters" });
  }, []);

  const openPlace = useCallback((order: Order) => {
    if (!passcodeRef.current) {
      setDialog({ type: "unlock" });
      return;
    }
    setDialog({ type: "place", order });
  }, []);

  const openUnlock = useCallback(() => setDialog({ type: "unlock" }), []);
  const closeDialog = useCallback(() => {
    intentRef.current = null;
    setDialog(null);
  }, []);
  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const createOrder = useCallback(
    async (input: OrderInput) => {
      await mutate("/api/orders", { method: "POST", body: JSON.stringify(input) }, (body) => {
        assertLogoSaved(input, body.state);
        applyState(body.state, body.celebration ?? null, true);
        setDialog(null);
        if (!body.celebration) flash({ message: `Added ${input.position} at ${input.client}.` });
      });
    },
    [applyState, flash, mutate],
  );

  const updateOrder = useCallback(
    async (id: string, input: OrderInput) => {
      await mutate(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }, (body) => {
        const saved = body.state.orders.find((order) => order.id === id);
        if (input.logo && saved?.logo !== input.logo) {
          throw new Error(`The order saved, but the logo didn't stick. The logo was ${formatKb(logoBytes(input.logo))}.`);
        }
        applyState(body.state, body.celebration ?? null, true);
        setDialog(null);
        if (!body.celebration) flash({ message: `Saved ${input.position} at ${input.client}.` });
      });
    },
    [applyState, flash, mutate],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        await mutate(`/api/orders/${id}`, { method: "DELETE" }, (body) => {
          applyState(body.state, null, true);
          flash({ message: "Order deleted." });
        });
      } catch (error) {
        flash({ message: error instanceof Error ? error.message : "That order couldn't be deleted." });
      } finally {
        setPendingId(null);
      }
    },
    [applyState, flash, mutate],
  );

  const fillOne = useCallback(
    async (order: Order, recruiterId: string) => {
      setPendingId(order.id);
      try {
        await mutate(
          `/api/orders/${order.id}/fill`,
          { method: "POST", body: JSON.stringify({ action: "increment", recruiterId }) },
          (body) => {
            applyState(body.state, body.celebration ?? null, true);
            setDialog((current) => (current?.type === "place" && current.order.id === order.id ? null : current));
            if (!body.celebration) {
              const name = body.state.recruiters.find((person) => person.id === recruiterId)?.name ?? "Placed";
              const left = Math.max(0, order.openings - order.filled - 1);
              flash({
                message: `${name} placed one ${order.position} at ${order.client}. ${left} ${left === 1 ? "spot" : "spots"} left.`,
                undoId: order.id,
              });
            }
          },
        );
      } catch (error) {
        flash({ message: error instanceof Error ? error.message : "That fill didn't save." });
      } finally {
        setPendingId(null);
      }
    },
    [applyState, flash, mutate],
  );

  const undoFill = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        await mutate(`/api/orders/${id}/fill`, { method: "POST", body: JSON.stringify({ action: "undo" }) }, (body) => {
          applyState(body.state, null, true);
          flash({ message: "Undid the last fill." });
          setCelebration((current) => {
            if (current?.orderId !== id) return current;
            showingRef.current = false;
            window.setTimeout(() => pump(), 180);
            return null;
          });
        });
      } catch (error) {
        flash({ message: error instanceof Error ? error.message : "That undo didn't save." });
      } finally {
        setPendingId(null);
      }
    },
    [applyState, flash, mutate, pump],
  );

  const saveRecruiter = useCallback(
    async (input: RecruiterInput, id?: string) => {
      const path = id ? `/api/recruiters/${id}` : "/api/recruiters";
      const method = id ? "PATCH" : "POST";
      await mutate(path, { method, body: JSON.stringify(input) }, (body) => {
        applyState(body.state, null, true);
        flash({ message: id ? `Saved ${input.name}.` : `Added ${input.name}.` });
      });
    },
    [applyState, flash, mutate],
  );

  const deleteRecruiter = useCallback(
    async (id: string) => {
      await mutate(`/api/recruiters/${id}`, { method: "DELETE" }, (body) => {
        applyState(body.state, null, true);
        flash({ message: "Recruiter removed." });
      });
    },
    [applyState, flash, mutate],
  );

  const addExample = useCallback(async () => {
    try {
      await mutate("/api/example-order", { method: "POST" }, (body) => {
        applyState(body.state, null, true);
        flash({ message: "Example order added. It is labeled and not a real job." });
      });
    } catch (error) {
      flash({ message: error instanceof Error ? error.message : "The example order wasn't added." });
    }
  }, [applyState, flash, mutate]);

  return {
    state,
    loading,
    online,
    loadError,
    now,
    unlocked,
    soundOn,
    dialog,
    toast,
    celebration,
    pendingId,
    setSoundOn,
    unlock,
    lock,
    openOrder,
    openRecruiters,
    openPlace,
    openUnlock,
    closeDialog,
    dismissToast,
    dismissCelebration,
    createOrder,
    updateOrder,
    deleteOrder,
    fillOne,
    undoFill,
    saveRecruiter,
    deleteRecruiter,
    addExample,
  };
}
