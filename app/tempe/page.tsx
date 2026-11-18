import type { Metadata } from "next";

import { OfficeBoard } from "@/components/OfficeBoard";

export const metadata: Metadata = { title: "Express Tempe · Open Orders" };

export default function TempePage() {
  return <OfficeBoard office="tempe" />;
}
