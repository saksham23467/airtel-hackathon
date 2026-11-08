#!/usr/bin/env node
// Live OCR of specimen packs against the running app. Prints outcomes only.
const base = process.env.UDYAM_BASE || "http://127.0.0.1:43123";
const personas = ["k12", "k11", "k01", "k03", "k07", "k06", "k04", "k02"];
const derived = ["K05", "K08", "K09", "K10"];
const kinds = ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"];

async function call(path, { method = "GET", cookie, json, form } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: form || (json ? JSON.stringify(json) : undefined),
  });
  const data = await response.json().catch(() => ({}));
  const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return { status: response.status, data, setCookie };
}

function sid(setCookie) {
  return setCookie.map((item) => item.split(";")[0]).find((item) => item.startsWith("udyam_sid=")) || "";
}

async function ocr(cookie, name) {
  const body = new FormData();
  body.set("specimen", name);
  const response = await call("/api/kyc", { method: "POST", cookie, form: body });
  const docs = response.data.documents || [];
  return docs.find((doc) => doc.fileName === name) || null;
}

async function runPersona(id) {
  const started = await call("/api/session", { method: "POST", json: { action: "start", personaId: id } });
  const cookie = sid(started.setCookie);
  const profile = started.data.session?.profile;
  await call("/api/session", { method: "POST", cookie, json: { action: "consent", purpose: "discover", granted: true } });
  await call("/api/session", { method: "POST", cookie, json: { action: "consent", purpose: "kyc", granted: true } });
  const prefix = (started.data.session.specimens || [])[0]?.name?.slice(0, 3);
  const results = [];
  for (const kind of kinds) {
    const name = `${prefix}_${kind}.png`;
    const doc = await ocr(cookie, name);
    results.push({ file: name, outcome: doc?.evaluation?.outcome || "missing", summary: doc?.evaluation?.summary || "" });
  }
  return { id, business: profile?.businessName, language: profile?.language, ui: profile?.uiLanguage, results };
}

async function runDerived(pack) {
  const started = await call("/api/session", { method: "POST", json: { action: "start", personaId: "blank" } });
  const cookie = sid(started.setCookie);
  const profile = { ...started.data.session.profile, businessName: "Unread specimen", claimsGstin: true, claimsUdyam: true };
  await call("/api/session", { method: "POST", cookie, json: { action: "consent", purpose: "discover", granted: true } });
  await call("/api/session", { method: "POST", cookie, json: { action: "profile", profile } });
  await call("/api/session", { method: "POST", cookie, json: { action: "consent", purpose: "kyc", granted: true } });
  const first = await ocr(cookie, `${pack}_gst_certificate.png`);
  const printed = first?.evaluation?.fields?.trade || first?.evaluation?.fields?.tradeOcr || first?.evaluation?.fields?.legal || "";
  let nameSource = "none";
  if (printed) {
    nameSource = "gst-ocr-field";
    await call("/api/session", { method: "POST", cookie, json: { action: "profile", profile: { ...profile, businessName: printed } } });
  }
  const results = [];
  for (const kind of kinds) {
    const name = `${pack}_${kind}.png`;
    const doc = await ocr(cookie, name);
    results.push({ file: name, outcome: doc?.evaluation?.outcome || "missing", summary: (doc?.evaluation?.summary || "").slice(0, 180) });
  }
  return { pack, nameSource, nameLength: printed.length, results };
}

const report = { personas: [], derived: [] };
for (const id of personas) report.personas.push(await runPersona(id));
for (const pack of derived) report.derived.push(await runDerived(pack));
console.log(JSON.stringify(report, null, 2));
