import type { Metadata } from "next";

import { OfficeBoard } from "@/components/OfficeBoard";

export const metadata: Metadata = { title: "Express Mesa · Open Orders" };

export default function MesaPage() {
  return <OfficeBoard office="mesa" />;
}
