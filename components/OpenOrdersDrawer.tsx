"use client";

import { useEffect, useMemo, useState } from "react";

import { OFFICES } from "@/lib/offices";
import type { OfficeId, Order } from "@/lib/types";

import { ClientLogo } from "./ClientLogo";

export function OpenOrdersDrawer({
  orders,
  currentOffice,
  onSelect,
}: {
  orders: Order[];
  currentOffice: OfficeId;
  onSelect: (order: Order) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aHere = a.office === currentOffice ? 0 : 1;
      const bHere = b.office === currentOffice ? 0 : 1;
      return aHere - bHere || a.dateOpened.localeCompare(b.dateOpened) || a.client.localeCompare(b.client);
    });
  }, [orders, currentOffice]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {open && (
        <button className="orders-backdrop" type="button" aria-label="Close open orders" onClick={() => setOpen(false)} />
      )}
      <button
        className={`orders-tab${open ? " is-open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="open-orders-drawer"
        data-testid="open-orders-tab"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="orders-tab-count">{orders.length}</span>
        <span>Open orders</span>
      </button>
      <aside
        id="open-orders-drawer"
        className={`orders-drawer${open ? " is-open" : ""}`}
        aria-label="All open orders"
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
        data-testid="open-orders-drawer"
      >
        <div className="orders-drawer-head">
          <div>
            <p className="eyebrow">Jump to a card</p>
            <h2>Open orders</h2>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <p className="orders-drawer-note">Every open job, both offices. Tap one to show that card.</p>
        {sorted.length === 0 ? (
          <p className="orders-drawer-note">No open orders right now. Filled jobs stay in the saved list.</p>
        ) : (
          <ul className="orders-jump-list">
            {sorted.map((order) => (
              <li key={order.id}>
                <button
                  className={`orders-jump${order.notBilling ? " is-not-billing" : ""}`}
                  type="button"
                  data-testid="open-order-jump"
                  data-office={order.office}
                  data-not-billing={order.notBilling ? "true" : "false"}
                  data-current={order.office === currentOffice ? "true" : "false"}
                  onClick={() => {
                    setOpen(false);
                    onSelect(order);
                  }}
                >
                  <ClientLogo client={order.client} logo={order.logo} size={36} />
                  <span className="orders-jump-copy">
                    <strong>{order.client}</strong>
                    <span>{order.position}</span>
                    {order.notBilling && <span className="pill pill-not-billing">Not billing yet</span>}
                  </span>
                  <span className="orders-jump-count" aria-label={`${order.filled} of ${order.openings} filled`}>
                    {order.filled}/{order.openings}
                  </span>
                  <span className="orders-jump-office">{OFFICES[order.office].short}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
