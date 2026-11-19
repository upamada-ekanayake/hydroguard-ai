import type { Metadata } from "next";
import {
  Hanken_Grotesk,
  Inter,
  JetBrains_Mono,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
} from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-var",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-heading-var",
  subsets: ["latin"],
});

/*
 * Latin-only families (Inter / JetBrains Mono / Hanken Grotesk) have no
 * Sinhala or Tamil glyphs, so the browser used to fall back to whatever
 * system font happened to be installed ("Iskoola Pota", "Nirmala UI"),
 * which breaks conjuncts and line heights. Noto is the reference family
 * for both scripts.
 */
const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-si-var",
  subsets: ["sinhala"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-ta-var",
  subsets: ["tamil"],
});

export const metadata: Metadata = {
  title: "HydroGuard AI // Command Center",
  description:
    "Autonomous multi-agent flood prediction, dam spill forecasting and trilingual evacuation alerts for Sri Lanka.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${hanken.variable} ${notoSinhala.variable} ${notoTamil.variable} h-full antialiased`}
    >
      <body className="h-full bg-[#eef2f7] text-slate-900">{children}</body>
    </html>
  );
}
