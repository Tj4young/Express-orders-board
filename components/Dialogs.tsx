"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { OFFICES, officeName, SHIFT_SUGGESTIONS } from "@/lib/offices";
import { formatPhoenixISODate } from "@/lib/time";
import type { OfficeId, Order, OrderInput } from "@/lib/types";

import { ClientLogo } from "./ClientLogo";
import { fileToLogo } from "./logo-file";
import { useBoard } from "./BoardProvider";

export function Dialogs() {
  const board = useBoard();
  const { dialog, closeDialog } = board;

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [dialog, closeDialog]);

  if (!dialog) return null;
  if (dialog.type !== "unlock" && !board.state) return null;

  return (
    <div className="backdrop" onMouseDown={closeDialog}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {dialog.type === "unlock" && <UnlockForm />}
        {dialog.type === "place" && <WhoPlaced order={dialog.order} />}
        {dialog.type === "recruiters" && <RecruiterForm />}
        {dialog.type === "order" && (
          <OrderForm key={dialog.order?.id ?? `new-${dialog.office}`} order={dialog.order} office={dialog.office} />
        )}
      </div>
    </div>
  );
}

function UnlockForm() {
  const { unlock, closeDialog } = useBoard();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        void unlock(passcode)
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "That passcode didn't match.");
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="eyebrow">Staff access</p>
      <h2>Unlock editing</h2>
      <p className="hint">
        Tempe and Mesa share one passcode. Viewing stays open, including the Battle TV, which never shows edit buttons.
      </p>
      <label className="field wide">
        Team passcode
        <input
          type="password"
          autoFocus
          value={passcode}
          autoComplete="current-password"
          onChange={(event) => setPasscode(event.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit" disabled={busy || passcode.length === 0}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </div>
    </form>
  );
}

function OrderForm({ order, office }: { order: Order | null; office: OfficeId }) {
  const { state, createOrder, updateOrder, closeDialog } = useBoard();
  const recruiters = useMemo(() => state?.recruiters ?? [], [state]);
  const [formOffice, setFormOffice] = useState<OfficeId>(order?.office ?? office);
  const [client, setClient] = useState(order?.client ?? "");
  const [position, setPosition] = useState(order?.position ?? "");
  const [payRate, setPayRate] = useState(order?.payRate ?? "");
  const [shift, setShift] = useState(order?.shift ?? "1st Shift");
  const [openings, setOpenings] = useState(order?.openings ?? 1);
  const [filled, setFilled] = useState(order?.filled ?? 0);
  const [recruiterId, setRecruiterId] = useState(
    order?.recruiterId ?? recruiters.find((person) => person.office === office)?.id ?? recruiters[0]?.id ?? "",
  );
  const [dateOpened, setDateOpened] = useState(order?.dateOpened ?? formatPhoenixISODate(new Date()));
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [logo, setLogo] = useState<string | null>(order?.logo ?? null);
  const [preparingLogo, setPreparingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const orderedRecruiters = useMemo(() => {
    return [...recruiters].sort((a, b) => {
      if (a.office === formOffice && b.office !== formOffice) return -1;
      if (b.office === formOffice && a.office !== formOffice) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [recruiters, formOffice]);

  const submit = async () => {
    if (preparingLogo) {
      setError("The photo is still being prepared. Wait until it appears, then save.");
      return;
    }
    const input: OrderInput = {
      office: formOffice,
      client,
      position,
      payRate,
      shift,
      openings,
      filled: Math.min(filled, openings),
      recruiterId,
      dateOpened,
      notes,
      logo,
    };
    setBusy(true);
    setError("");
    try {
      if (order) await updateOrder(order.id, input);
      else await createOrder(input);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn't save.");
      setBusy(false);
    }
  };

  return (
    <form
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="eyebrow">{order ? "Edit order" : "New order"}</p>
      <h2>{order ? `${order.position}` : "Add an open order"}</h2>
      {(error || logoError) && (
        <p className="form-error" role="alert">
          {error || logoError}
        </p>
      )}
      <div className="form-grid">
        <label className="field">
          Office
          <select value={formOffice} onChange={(event) => setFormOffice(event.target.value as OfficeId)}>
            <option value="tempe">Express Tempe</option>
            <option value="mesa">Express Mesa</option>
          </select>
        </label>
        <label className="field">
          Opened by
          <select value={recruiterId} onChange={(event) => setRecruiterId(event.target.value)}>
            {orderedRecruiters.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {OFFICES[person.office].short}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Client
          <input value={client} onChange={(event) => setClient(event.target.value)} required maxLength={80} />
        </label>
        <label className="field">
          Position
          <input value={position} onChange={(event) => setPosition(event.target.value)} required maxLength={80} />
        </label>
        <label className="field">
          Pay rate
          <input
            value={payRate}
            placeholder="$18.50/hr"
            onChange={(event) => setPayRate(event.target.value)}
            required
            maxLength={40}
          />
        </label>
        <label className="field">
          Shift
          <input
            value={shift}
            list="shift-suggestions"
            onChange={(event) => setShift(event.target.value)}
            required
            maxLength={40}
          />
          <datalist id="shift-suggestions">
            {SHIFT_SUGGESTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field">
          Openings
          <input
            type="number"
            min={1}
            max={500}
            value={openings}
            onChange={(event) => {
              const next = Number(event.target.value);
              setOpenings(next);
              if (filled > next) setFilled(next);
            }}
            required
          />
        </label>
        <label className="field">
          Filled
          <input
            type="number"
            min={0}
            max={openings}
            value={filled}
            onChange={(event) => setFilled(Number(event.target.value))}
            required
          />
        </label>
        <label className="field">
          Date opened
          <input type="date" value={dateOpened} max={formatPhoenixISODate(new Date())} onChange={(event) => setDateOpened(event.target.value)} required />
        </label>
        <label className="field wide">
          Notes
          <textarea value={notes} maxLength={500} rows={3} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="field wide">
          <span>Client logo</span>
          <div className="logo-upload" data-testid="logo-upload">
            <ClientLogo client={client || "Client"} logo={logo} size={64} />
            <div className="logo-upload-actions">
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setLogoError("");
                  setError("");
                  setPreparingLogo(true);
                  void fileToLogo(file)
                    .then(setLogo)
                    .catch((reason: unknown) => {
                      setLogo(null);
                      setLogoError(reason instanceof Error ? reason.message : "Couldn't use that logo.");
                    })
                    .finally(() => setPreparingLogo(false));
                }}
              />
              <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()} disabled={preparingLogo}>
                {preparingLogo ? "Preparing photo…" : logo ? "Replace logo" : "Upload logo"}
              </button>
              {logo && (
                <button className="btn btn-ghost" type="button" onClick={() => setLogo(null)}>
                  Remove
                </button>
              )}
              <p className="hint">PNG, JPG, WebP, or SVG. Large photos are resized to fit.</p>
            </div>
          </div>
          {logoError && (
            <p className="form-error" role="alert">
              {logoError}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit" disabled={busy || preparingLogo}>
          {preparingLogo ? "Preparing photo…" : busy ? "Saving…" : order ? "Save changes" : "Add order"}
        </button>
      </div>
    </form>
  );
}

function WhoPlaced({ order }: { order: Order }) {
  const { state, fillOne, closeDialog, pendingId } = useBoard();
  const people = state?.recruiters ?? [];
  const owner = people.find((person) => person.id === order.recruiterId) ?? null;
  const others = people.filter((person) => person.id !== owner?.id);
  const busy = pendingId === order.id;

  const choose = (recruiterId: string) => {
    void fillOne(order, recruiterId);
  };

  return (
    <div data-testid="who-placed">
      <p className="eyebrow">Placement</p>
      <h2>Who placed this person?</h2>
      <p className="hint">
        {order.position} at {order.client}. {owner ? `${owner.name} opened the order and is first.` : "Choose who gets credit for this head."}
      </p>
      <div className="placer-list">
        {owner && (
          <button
            className="btn btn-primary placer-btn"
            type="button"
            autoFocus
            data-testid={`placer-${owner.id}`}
            disabled={busy}
            onClick={() => choose(owner.id)}
          >
            <span>
              {owner.name}
              <small>{officeName(owner.office)} · opened this order</small>
            </span>
          </button>
        )}
        {others.map((person) => (
          <button
            key={person.id}
            className="btn btn-ghost placer-btn"
            type="button"
            data-testid={`placer-${person.id}`}
            disabled={busy}
            onClick={() => choose(person.id)}
          >
            <span>
              {person.name}
              <small>{OFFICES[person.office].short}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={closeDialog} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RecruiterForm() {
  const { state, saveRecruiter, closeDialog } = useBoard();
  const [name, setName] = useState("");
  const [office, setOffice] = useState<OfficeId>("tempe");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  return (
    <div>
      <p className="eyebrow">Desk</p>
      <h2>Recruiters</h2>
      <p className="hint">
        Ivonne, Isabella, and Jane start on Express Tempe. Alex and Tim start on Express Mesa. Change an office anytime.
        Fills already counted stay with the order&apos;s office.
      </p>
      <ul className="recruiter-list">
        {state.recruiters.map((person) => (
          <RecruiterRow key={`${person.id}:${person.name}:${person.office}`} id={person.id} name={person.name} office={person.office} />
        ))}
      </ul>
      <form
        className="recruiter-add"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          void saveRecruiter({ name, office })
            .then(() => setName(""))
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : "That name wasn't added.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <label className="field">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
        </label>
        <label className="field">
          Office
          <select value={office} onChange={(event) => setOffice(event.target.value as OfficeId)}>
            <option value="tempe">Express Tempe</option>
            <option value="mesa">Express Mesa</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Add
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={closeDialog}>
          Done
        </button>
      </div>
    </div>
  );
}

function RecruiterRow({ id, name: initialName, office: initialOffice }: { id: string; name: string; office: OfficeId }) {
  const { saveRecruiter, deleteRecruiter } = useBoard();
  const [name, setName] = useState(initialName);
  const [office, setOffice] = useState<OfficeId>(initialOffice);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = name !== initialName || office !== initialOffice;

  return (
    <li>
      <label className="field">
        <span className="sr-only">Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
      </label>
      <label className="field">
        <span className="sr-only">Office</span>
        <select value={office} onChange={(event) => setOffice(event.target.value as OfficeId)}>
          <option value="tempe">Tempe</option>
          <option value="mesa">Mesa</option>
        </select>
      </label>
      <button
        className="btn btn-ghost"
        type="button"
        disabled={!dirty || busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void saveRecruiter({ name, office }, id)
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Couldn't save."))
            .finally(() => setBusy(false));
        }}
      >
        Save
      </button>
      <button
        className="btn btn-ghost"
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void deleteRecruiter(id)
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Couldn't remove."))
            .finally(() => setBusy(false));
        }}
      >
        Remove
      </button>
      {error && <p className="form-error">{error}</p>}
    </li>
  );
}
