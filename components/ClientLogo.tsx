"use client";

import { useState } from "react";

import { clientInitials } from "@/lib/logo";

export function ClientLogo({
  client,
  logo,
  size = 48,
}: {
  client: string;
  logo?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const initials = clientInitials(client);
  const showImage = Boolean(logo) && !broken;
  return (
    <span
      className="client-mark"
      style={{ width: size, height: size }}
      data-testid={showImage ? "client-logo" : "client-initials"}
    >
      {showImage ? (
        // The value is a data URL checked before it is saved.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo ?? ""}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
