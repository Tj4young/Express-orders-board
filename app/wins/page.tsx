import type { Metadata } from "next";

import { WinsView } from "@/components/WinsView";

export const metadata: Metadata = { title: "Wins · Express Open Orders" };

export default function WinsPage() {
  return <WinsView />;
}
