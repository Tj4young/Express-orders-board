import type { Metadata } from "next";

import { BattleView } from "@/components/BattleView";

export const metadata: Metadata = { title: "Battle TV · Express Tempe vs Mesa" };

export default function BattlePage() {
  return <BattleView />;
}
