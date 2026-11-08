import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import type { Session } from "@/lib/types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  const id = jar.get("udyam_sid")?.value;
  if (!id) return null;
  return readStore().sessions[id] || null;
}

export async function setSessionCookie(id: string) {
  const jar = await cookies();
  jar.set("udyam_sid", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete("udyam_sid");
}
