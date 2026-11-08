import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const out = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(out, { recursive: true });
const base = "http://127.0.0.1:43123";

function shot(page, name) {
  return page.screenshot({ path: path.join(out, name), fullPage: true });
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(base);
await desktop.getByRole("heading", { name: "A small business can leave with one quote." }).waitFor();
await shot(desktop, "01-home-desktop.png");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(base);
await mobile.getByRole("heading", { name: "A small business can leave with one quote." }).waitFor();
await shot(mobile, "02-home-mobile.png");
if (!(await overflow(mobile))) throw new Error("home mobile overflows");

await desktop.getByRole("button", { name: "Open Star Electronics" }).click();
await desktop.getByRole("heading", { name: "Consent before any scoring" }).waitFor();
await shot(desktop, "03-consent.png");
await desktop.getByRole("checkbox").first().click();
await desktop.getByRole("button", { name: "Continue" }).click();
await desktop.getByRole("button", { name: "Score the catalogue" }).waitFor();
await shot(desktop, "04-business-context.png");
await desktop.getByRole("button", { name: "Score the catalogue" }).click();
await desktop.getByText("Gradient boosting ranker").waitFor({ timeout: 20000 });
await shot(desktop, "05-recommendations.png");
await desktop.getByRole("button", { name: "4. Advisor" }).click();
await desktop.getByRole("button", { name: "This is too expensive" }).click();
await desktop.getByText("Grounded composer").waitFor();
await desktop.getByText("catalogue band").first().waitFor();
await shot(desktop, "06-advisor.png");
await desktop.getByRole("button", { name: "3. Catalogue bundle" }).click();
await desktop.getByRole("button", { name: "Use this bundle" }).nth(1).click();
await desktop.getByText("Pre-tax monthly").waitFor();
await shot(desktop, "07-quote.png");
await desktop.setViewportSize({ width: 390, height: 844 });
await desktop.goto(base + "/journey");
await desktop.getByText("Pre-tax monthly").waitFor();
await shot(desktop, "08-quote-mobile.png");
if (!(await overflow(desktop))) throw new Error("quote mobile overflows");
await desktop.setViewportSize({ width: 1440, height: 900 });

const fibre = desktop.locator("article", { hasText: "Biz Fibre" }).first();
await fibre.getByRole("button", { name: "Remove" }).click();
await desktop.getByText("Checkout is blocked").waitFor({ timeout: 10000 });
await shot(desktop, "09-quote-dependency.png");

await desktop.getByRole("button", { name: "6. KYC" }).click();
await desktop.getByRole("checkbox").first().click();
await desktop.getByRole("button", { name: /Run OCR on K12 gst/ }).click();
await desktop.getByText("Mock GST registry").waitFor({ timeout: 20000 });
await shot(desktop, "10-kyc-pass-doc.png");

await desktop.goto(base);
await desktop.getByRole("button", { name: "Open Trinity Bake House" }).click();
await desktop.getByRole("checkbox").first().click();
await desktop.getByRole("button", { name: "आगे बढ़ें" }).click();
await desktop.getByRole("button", { name: "Score the catalogue" }).click();
await desktop.getByText("Gradient boosting ranker").waitFor({ timeout: 20000 });
await desktop.getByRole("button", { name: /केवाईसी/ }).click();
await desktop.getByRole("checkbox").first().click();
await desktop.getByRole("button", { name: /address proof/ }).click();
await desktop.getByText("older than 90 days").first().waitFor({ timeout: 20000 });
await shot(desktop, "11-kyc-stale-bill.png");

await desktop.goto(base + "/admin");
await desktop.getByRole("heading", { name: "What this run actually did" }).waitFor();
await shot(desktop, "12-evidence-desk.png");
await desktop.goto(base + "/architecture");
await shot(desktop, "13-architecture.png");
await desktop.goto(base + "/privacy");
await shot(desktop, "14-privacy-note.png");

await desktop.setViewportSize({ width: 390, height: 844 });
await desktop.goto(base + "/admin");
await desktop.getByRole("heading", { name: "What this run actually did" }).waitFor();
if (!(await overflow(desktop))) throw new Error("admin mobile overflows");
await shot(desktop, "15-evidence-mobile.png");

await browser.close();
console.log("screenshots", fs.readdirSync(out).length);
