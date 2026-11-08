import type { StoreData } from "@/lib/types";

/** Demo purge window. `off` disables the sweep. This is not a statutory KYC period. */
export function retentionDays(): number | null {
  const raw = process.env.UDYAM_RETENTION_DAYS;
  if (raw === "off") return null;
  if (raw == null || raw.trim() === "") return 14;
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) return 14;
  return days;
}

export function planRetention(store: StoreData, now = Date.now()): {
  changed: boolean;
  purgedSessions: number;
  purgedOrders: number;
  files: string[];
} {
  const days = retentionDays();
  if (days == null) return { changed: false, purgedSessions: 0, purgedOrders: 0, files: [] };
  const cutoff = now - days * 86_400_000;
  const stamp = new Date(now).toISOString();
  const files: string[] = [];
  let changed = false;

  for (const session of Object.values(store.sessions)) {
    if (!session.storedAt) {
      session.storedAt = stamp;
      changed = true;
    }
  }
  for (const order of Object.values(store.orders)) {
    if (!order.storedAt) {
      order.storedAt = stamp;
      changed = true;
    }
  }

  let purgedSessions = 0;
  let purgedOrders = 0;
  for (const session of Object.values(store.sessions)) {
    if (Date.parse(session.storedAt || stamp) >= cutoff) continue;
    for (const doc of session.kyc || []) {
      if (doc.storedAs && doc.source === "upload") files.push(doc.storedAs);
    }
    if (session.orderId && store.orders[session.orderId]) {
      delete store.orders[session.orderId];
      purgedOrders += 1;
    }
    delete store.sessions[session.id];
    purgedSessions += 1;
    changed = true;
  }
  for (const order of Object.values(store.orders)) {
    if (Date.parse(order.storedAt || stamp) >= cutoff) continue;
    delete store.orders[order.id];
    const session = store.sessions[order.sessionId];
    if (session?.orderId === order.id) session.orderId = undefined;
    purgedOrders += 1;
    changed = true;
  }
  if (purgedSessions || purgedOrders) {
    store.audit.push({
      event: "retention_purged",
      caseTime: stamp,
      detail: `wall-clock purge; sessions ${purgedSessions}; orders ${purgedOrders}; retentionDays ${days}; plaintext JSON; not encryption and not a statutory KYC schedule`,
    });
  }
  return { changed, purgedSessions, purgedOrders, files };
}
