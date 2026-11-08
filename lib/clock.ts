import { CASE_TODAY } from "@/lib/gstin";

export function caseStamp(minute: number): string {
  const base = Date.parse(`${CASE_TODAY}T09:00:00+05:30`);
  return new Date(base + minute * 60_000).toISOString();
}

export function tickClock(session: { clock: number }): string {
  session.clock += 1;
  return caseStamp(session.clock);
}

export function hasConsent(session: { consents: { purpose: string; granted: boolean }[] }, purpose: string): boolean {
  return session.consents.some((consent) => consent.purpose === purpose && consent.granted);
}
