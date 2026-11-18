"use client";

import { useState } from "react";

import { OFFICES } from "@/lib/offices";
import { formatPrettyDateTime } from "@/lib/time";
import type { Order } from "@/lib/types";

export function WinCard({
  order,
  recruiterName,
  fresh,
  unlocked,
  pending,
  onUndo,
  onEdit,
  onDelete,
}: {
  order: Order;
  recruiterName: string;
  fresh: boolean;
  unlocked: boolean;
  pending: boolean;
  onUndo: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <article className={`win-card${fresh ? " is-new" : ""}${order.example ? " is-example" : ""}`} data-testid="win-card">
      <p className="card-kicker">{OFFICES[order.office].name}</p>
      <h3>{order.client}</h3>
      <p className="card-position">{order.position}</p>
      <p className="win-when">{order.dateFilled ? `Filled ${formatPrettyDateTime(order.dateFilled)}` : "Filled"}</p>
      <p className="compact-meta">
        {order.filled} of {order.openings} · {recruiterName} · {order.shift} · {order.payRate}
      </p>
      {order.example && <span className="pill pill-example">Example</span>}
      {unlocked && (
        <div className="card-secondary">
          <button className="btn btn-ghost" type="button" disabled={pending} onClick={onUndo}>
            Undo last fill
          </button>
          <button className="btn btn-ghost" type="button" disabled={pending} onClick={onEdit}>
            Edit
          </button>
          {confirmDelete ? (
            <button className="btn btn-danger" type="button" disabled={pending} onClick={onDelete}>
              Delete
            </button>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
