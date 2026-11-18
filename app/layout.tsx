import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";

import { BoardProvider } from "@/components/BoardProvider";

import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-family",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body-family",
});

export const metadata: Metadata = {
  title: {
    default: "Express Open Orders Board",
    template: "%s",
  },
  description: "Live open orders for Express Tempe and Express Mesa.",
  applicationName: "Express Open Orders Board",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#E31837",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <BoardProvider>{children}</BoardProvider>
      </body>
    </html>
  );
}
