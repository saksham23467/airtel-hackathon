import { timingSafeEqual } from "crypto";

export type OrderActor = "desk" | "owner" | "anonymous" | "other-session";

/** Shorter values are refused so an empty or placeholder variable cannot open the desk. */
export const DESK_KEY_MIN_LENGTH = 16;

export function deskAuthorized(header: string | null | undefined): boolean {
  const expected = process.env.DEMO_DESK_KEY || "";
  if (expected.length < DESK_KEY_MIN_LENGTH) return false;
  const exp = Buffer.from(expected);
  const presented = Buffer.from(header || "");
  if (presented.length !== exp.length) return false;
  return timingSafeEqual(presented, exp);
}

export function classifyOrderAccess(input: {
  desk: boolean;
  cookieSessionId: string | null;
  orderSessionId: string;
}): OrderActor {
  if (input.desk) return "desk";
  if (!input.cookieSessionId) return "anonymous";
  if (input.cookieSessionId === input.orderSessionId) return "owner";
  return "other-session";
}

export function canReadOrder(actor: OrderActor): boolean {
  return actor === "desk" || actor === "owner";
}

export function canAdvanceOrder(actor: OrderActor): boolean {
  return actor === "desk" || actor === "owner";
}
