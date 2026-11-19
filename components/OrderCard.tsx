"use client";

import { useState } from "react";

import { spotsLeft } from "@/lib/filters";
import { OFFICES } from "@/lib/offices";
import { calendarDaysBetween, formatPrettyDate, isAging } from "@/lib/time";
import type { Order } from "@/lib/types";

type CardProps = {
  order: Order;
  recruiterName: string;
  credit?: string;
  today: string | null;
  readOnly: boolean;
  exiting?: boolean;
  pending?: boolean;
  onFill: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function OrderCard({
  order,
  recruiterName,
  credit = "",
  today,
  readOnly,
  exiting = false,
  pending = false,
  onFill,
  onUndo,
  onEdit,
  onDelete,
}: CardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const aging = today ? isAging(order.dateOpened, today, order.dateFilled) : false;
  const days = today ? calendarDaysBetween(order.dateOpened, today) : 0;
  const left = spotsLeft(order);
  const pct = order.openings === 0 ? 0 : Math.min(100, Math.round((order.filled / order.openings) * 100));

  return (
    <article
      className={`order-card${aging ? " is-aging" : ""}${order.example ? " is-example" : ""}${exiting ? " is-exiting" : ""}`}
      data-testid="order-card"
      data-office={order.office}
      data-example={order.example ? "true" : "false"}
    >
      <div className="card-top">
        <div>
          <p className="card-kicker">{OFFICES[order.office].name}</p>
          <h3>{order.client}</h3>
          <p className="card-position">{order.position}</p>
        </div>
        <div className="card-badges">
          {order.example && <span className="pill pill-example">Example</span>}
          {aging && <span className="pill pill-aging">Aging · {days} days</span>}
        </div>
      </div>
      <p className="card-left">
        <strong>{left}</strong>
        <span>{left === 1 ? "spot left" : "spots left"}</span>
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        {order.filled} of {order.openings} filled
      </p>
      {credit && (
        <p className="credit-line" data-testid="placement-credit">
          {credit}
        </p>
      )}
      <dl className="meta">
        <div>
          <dt>Pay</dt>
          <dd>{order.payRate}</dd>
        </div>
        <div>
          <dt>Shift</dt>
          <dd>{order.shift}</dd>
        </div>
        <div>
          <dt>Opened by</dt>
          <dd>{recruiterName}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{formatPrettyDate(order.dateOpened)}</dd>
        </div>
      </dl>
      {order.notes && (
        <p className="order-notes" title={order.notes}>
          {order.notes}
        </p>
      )}
      {!readOnly && (
        <div className="card-actions">
          {!exiting && order.filled < order.openings && (
            <button className="btn btn-fill" type="button" data-testid="fill-button" disabled={pending} onClick={onFill}>
              +1 Filled
            </button>
          )}
          <div className="card-secondary">
            {order.filled > 0 && (
              <button className="btn btn-ghost" type="button" data-testid="undo-button" disabled={pending} onClick={onUndo}>
                Undo
              </button>
            )}
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={onEdit}>
              Edit
            </button>
            {confirmDelete ? (
              <>
                <button className="btn btn-danger" type="button" disabled={pending} onClick={onDelete}>
                  Delete
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function CompactOrder({
  order,
  recruiterName,
  credit = "",
  today,
}: {
  order: Order;
  recruiterName: string;
  credit?: string;
  today: string | null;
}) {
  const aging = today ? isAging(order.dateOpened, today, order.dateFilled) : false;
  const days = today ? calendarDaysBetween(order.dateOpened, today) : 0;
  const left = spotsLeft(order);
  const pct = order.openings === 0 ? 0 : Math.min(100, Math.round((order.filled / order.openings) * 100));
  return (
    <article className={`compact-card${aging ? " is-aging" : ""}${order.example ? " is-example" : ""}`} data-testid="battle-order">
      <div className="compact-top">
        <h3>{order.client}</h3>
        {order.example && <span className="pill pill-example">Example</span>}
        {aging && <span className="pill pill-aging">Aging · {days}d</span>}
      </div>
      <p className="compact-position">{order.position}</p>
      <p className="compact-meta">
        {order.payRate} · {order.shift}
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="compact-foot">
        <strong>{left} left</strong> · {order.filled}/{order.openings} · {recruiterName}
      </p>
      {credit && <p className="credit-line">{credit}</p>}
    </article>
  );
}
