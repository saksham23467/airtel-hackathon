import type { Metadata } from "next";
import { Fraunces, Noto_Sans_Devanagari, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const body = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600", "700"], variable: "--font-deva" });

export const metadata: Metadata = {
  title: "Udyam Digital · Accel Business",
  description: "Synthetic onboarding demo for a small business to choose a dependency-complete Accel Business bundle, check KYC, and follow a simulated order.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${devanagari.variable} antialiased`}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
