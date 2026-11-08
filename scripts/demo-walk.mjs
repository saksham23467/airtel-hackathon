#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const base = process.env.UDYAM_BASE || "http://127.0.0.1:43123";
const out = process.env.SHOTS || "/opt/cursor/artifacts";
const slow = process.env.RECORD === "1";
const pauseMs = slow ? 1400 : 250;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: ["--window-position=40,40", "--window-size=1280,800"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const notes = [];

async function shot(name) {
  const file = path.join(out, name);
  await page.screenshot({ path: file, fullPage: false });
  notes.push(name);
}

async function cap(text) {
  await page.evaluate((text) => {
    let bar = document.getElementById("demo-cap");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "demo-cap";
      bar.style.cssText = "position:fixed;left:16px;top:12px;max-width:520px;z-index:99999;pointer-events:none;background:#1c1917;color:#fff;padding:10px 14px;border-radius:12px;font:600 16px/1.35 ui-sans-serif,sans-serif";
      document.body.appendChild(bar);
    }
    bar.textContent = text;
  }, text);
  if (pauseMs) await page.waitForTimeout(pauseMs);
}

async function starPath() {
  await page.goto(base, { waitUntil: "networkidle" });
  await cap("Synthetic catalogue. No live network or payment.");
  await shot("01-home-desktop.png");
  await page.getByRole("button", { name: "Open Star Electronics" }).click();
  await page.getByText("I agree to needs discovery").click();
  await page.getByRole("button", { name: "Continue" }).waitFor();
  await cap("Discovery consent is stored before any score.");
  await shot("03-consent.png");
  await page.getByRole("button", { name: "Continue" }).click({ timeout: 15000 });
  await page.getByRole("button", { name: "Score the catalogue" }).click();
  await page.getByRole("button", { name: "Use this bundle" }).first().click();
  await cap("Quote uses catalogue floors. Removing a line recomputes the total.");
  await shot("05-quote.png");
  const remove = page.getByRole("button", { name: "Remove" }).first();
  if (await remove.count()) await remove.click();
  await page.waitForTimeout(400);
  await shot("05b-quote-edited.png");
  await page.getByRole("button", { name: "4. Advisor" }).click();
  await page.getByRole("button", { name: "I only need internet" }).click();
  await page.getByText(/Generated locally|Deterministic fallback/).first().waitFor({ timeout: 20000 });
  await cap("Each reply is labelled generated or deterministic fallback.");
  await shot("04-advisor.png");
  await page.locator("button").filter({ hasText: "6. KYC" }).click();
  await page.getByText("I agree to OCR").click();
  await page.getByRole("button", { name: /K12 gst/i }).waitFor({ timeout: 15000 });
  for (const label of ["K12 gst", "K12 udyam", "K12 address", "K12 signatory"]) {
    await page.getByRole("button", { name: new RegExp(label, "i") }).click();
    await page.waitForTimeout(900);
  }
  await cap("Star Electronics specimens. Local OCR and mock registries.");
  await shot("06-kyc-pass.png");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.getByText("I understand this checkout").click();
  await page.getByText("Record a simulated payment").click();
  await page.getByRole("button", { name: "Create simulated order" }).click();
  await page.getByRole("link", { name: /Open tracker/ }).click();
  await cap("Simulated tracker. No money moved.");
  await page.getByRole("button", { name: /milestone/ }).click();
  await page.waitForTimeout(500);
  await shot("08-tracker.png");
  await page.getByRole("link", { name: /partner handoff|हैंडऑफ/i }).click();
  await page.waitForURL(/\/handoff\//, { timeout: 15000 });
  await page.getByText(/Simulation route|सिम्युलेशन रूट/).first().waitFor({ timeout: 15000 });
  await cap("Partner view. Registration numbers are masked. No message was sent.");
  await shot("09-handoff.png");
}

async function failurePath() {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Trinity Bake House/ }).click();
  await page.locator("label").first().click();
  await page.getByRole("button", { name: /Continue|आगे बढ़ें/ }).click({ timeout: 15000 });
  await page.getByRole("button", { name: /KYC|केवाईसी/ }).click();
  await page.locator("label").first().click();
  await page.getByRole("button", { name: /K11 address/i }).click();
  await page.getByText(/failed|फ़ेल|पास नहीं/).first().waitFor({ timeout: 20000 });
  await cap("Trinity bill is outside the 90-day rule. Case clock 15 July 2026.");
  await shot("07-kyc-fail.png");
}

try {
  await starPath();
  await failurePath();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  notes.push(`mobile-overflow-px:${overflow}`);
  await page.getByRole("button", { name: "Open Star Electronics" }).scrollIntoViewIfNeeded();
  await shot("02-home-mobile.png");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.getByLabel("Demo desk key").scrollIntoViewIfNeeded();
  const deskEmpty = await page.getByLabel("Demo desk key").inputValue();
  notes.push(`admin-key-empty:${deskEmpty.length === 0}`);
  await shot("10-admin-empty.png");
  await page.goto(`${base}/privacy`, { waitUntil: "networkidle" });
  await shot("11-privacy.png");
  console.log(JSON.stringify({ ok: true, notes }, null, 2));
} catch (error) {
  await shot("error.png").catch(() => {});
  console.error(error);
  console.log(JSON.stringify({ ok: false, notes, error: String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
