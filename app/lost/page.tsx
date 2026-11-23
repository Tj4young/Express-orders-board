import type { Metadata } from "next";

import { LostView } from "@/components/LostView";

export const metadata: Metadata = { title: "Lost orders · Express Open Orders" };

export default function LostPage() {
  return <LostView />;
}
