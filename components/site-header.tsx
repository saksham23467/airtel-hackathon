"use client";

import Link from "next/link";

export function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c2433" />
      <path d="M8 24 L16 8 L24 24" fill="none" stroke="#f6f1e8" strokeWidth="2" />
      <path d="M11.2 18.5 H20.8" stroke="#c4622d" strokeWidth="2.2" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Mark />
          <span>
            <span className="block text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">ACCEL BUSINESS</span>
            <span className="font-display text-lg leading-none">Udyam Digital</span>
          </span>
        </Link>
        <span className="sim-pill">Synthetic demo · no live network</span>
        <nav className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <Link href="/journey" className="hover:underline">Journey</Link>
          <Link href="/admin" className="hover:underline">Evidence desk</Link>
          <Link href="/architecture" className="hover:underline">Architecture</Link>
          <Link href="/privacy" className="hover:underline">Privacy note</Link>
        </nav>
      </div>
    </header>
  );
}
