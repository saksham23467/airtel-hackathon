import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { assemble } from "@/lib/assemble";
import { loadCatalogue, loadGstRegistry, loadUdyamRegistry } from "@/lib/catalogue";
import { hasConsent, tickClock } from "@/lib/clock";
import { businessNamesAlign, evaluateDocument, kycGate } from "@/lib/kyc";
import { ageInDays, checksumCandidates, chooseGstinReading, gstinChecksumOk, maskGstin } from "@/lib/gstin";
import { citedMoney, mentionsSuppliedProduct, moneyOutsideFacts, generationUnusable } from "@/lib/grounding";
import { buildQuote, quoteText, taxOn } from "@/lib/quote";
import { redact } from "@/lib/redact";
import { updateStore } from "@/lib/store";
import { runOcr } from "@/lib/ocr";

describe("gstin", () => {
  it("checks the supplied checksums", () => {
    expect(gstinChecksumOk("37NBLXS1145E1ZU")).toBe(true);
    expect(gstinChecksumOk("37IHKXV5167L1ZS")).toBe(true);
    expect(gstinChecksumOk("08YKZXS8189L1Z0")).toBe(false);
  });

  it("repairs the specimen tokens without inventing K06", () => {
    const registry = loadGstRegistry();
    const known = (value: string) => registry.has(value);
    expect(chooseGstinReading("07CPCXNO398P1ZT", known).value).toBe("07CPCXN0398P1ZT");
    expect(chooseGstinReading("37THKXV5167L1ZS", known).value).toBe("37IHKXV5167L1ZS");
    expect(chooseGstinReading("O3KGZXT1320R12ZZ", known).value).toBe("03KGZXT1320R1ZZ");
    expect(chooseGstinReading("O8YKZXS8189L1Z0", known).value).toBeNull();
    expect(checksumCandidates("37NBLXS1145E1ZU")).toEqual(["37NBLXS1145E1ZU"]);
  });
});

describe("catalogue rules", () => {
  it("assembles a base before the dependent and keeps budgets separate", () => {
    const deps = { P22: ["P01"], P19: [], P18: [], P01: [] };
    const ranked = ["P22", "P19", "P18", "P01"];
    expect(assemble(ranked, deps, 1)).toEqual(["P19"]);
    expect(assemble(ranked, deps, 3)).toEqual(["P01", "P22", "P19"]);
    expect(assemble(ranked, deps, 3).slice(0, 1)).not.toEqual(assemble(ranked, deps, 1));
  });

  it("prices the SD-WAN example from the catalogue, not a made-up tariff", () => {
    const products = loadCatalogue();
    const quote = buildQuote([{ id: "P10", qty: 8 }, { id: "P02", qty: 8 }], products, {
      segmentKey: "multi",
      tier: 1,
      employees: 120,
      sites: 8,
      gstActive: true,
    });
    const sdwan = quote.lines.find((line) => line.id === "P10")!;
    expect(sdwan.monthly).toBe(20000);
    expect(sdwan.setup).toBe(40000);
    expect(quote.contractMonths).toBe(24);
    expect(quote.valid).toBe(true);
    expect(taxOn(20000)).toBe(3600);
    expect(quoteText(quote, "Example")).toContain("20000");
  });

  it("blocks Wi-Fi without a base connection", () => {
    const products = loadCatalogue();
    const quote = buildQuote([{ id: "P22", qty: 1 }], products, {
      segmentKey: "micro",
      tier: 2,
      employees: 4,
      sites: 1,
      gstActive: true,
    });
    expect(quote.valid).toBe(false);
    expect(quote.problems.some((problem) => problem.includes("P22"))).toBe(true);
  });

  it("blocks GST products when the mock GSTIN is cancelled", () => {
    const products = loadCatalogue();
    const quote = buildQuote([{ id: "P14", qty: 1 }], products, {
      segmentKey: "micro",
      tier: 2,
      employees: 5,
      sites: 1,
      gstActive: false,
    });
    expect(quote.valid).toBe(false);
  });
});

describe("kyc decisions", () => {
  it("fails a stale bill and passes a fresh one", () => {
    expect(ageInDays("2025-10-31")).toBeGreaterThan(90);
    expect(ageInDays("2026-07-06")).toBeLessThanOrEqual(90);
    const stale = evaluateDocument("address", "Specimen Electricity Bill Billed to Trinity Bake House Pvt Ltd Supply address Shop Bill date 2025-10-31", {
      businessName: "Trinity Bake House Pvt Ltd",
      gst: loadGstRegistry(),
      udyam: loadUdyamRegistry(),
    });
    expect(stale.outcome).toBe("failed");
    const fresh = evaluateDocument("address", "Specimen Electricity Bill Billed to Star Electronics Supply address Shop Bill date 2026-07-06", {
      businessName: "Star Electronics",
      gst: loadGstRegistry(),
      udyam: loadUdyamRegistry(),
    });
    expect(fresh.outcome).toBe("passed");
  });

  it("does not treat Shri and Neelgiri as the same legal name", () => {
    expect(businessNamesAlign("Neha Banerjee (Prop. Shri Physio Clinic)", "Neha Banerjee (Prop. Neelgiri Physio Clinic)")).toBe(false);
    expect(businessNamesAlign("Star Electronics", "Star Electronics")).toBe(true);
  });

  it("requires discovery consent and can withhold checkout", () => {
    expect(hasConsent({ consents: [] }, "kyc")).toBe(false);
    expect(kycGate([], false).status).toBe("incomplete");
  });
});

describe("advisor grounding", () => {
  it("accepts catalogue rupees and rejects an invented price", () => {
    const allowed = [999, 1199, 0, 1897, 1800];
    expect(citedMoney("Biz Fibre 100 is Rs 999 a month, and the quote is Rs 1,897.")).toEqual([999, 1897]);
    expect(moneyOutsideFacts("The floor is Rs 999.", allowed)).toEqual([]);
    expect(moneyOutsideFacts("A secret plan is Rs 4999.", allowed)).toEqual([4999]);
    expect(moneyOutsideFacts("Rs 100", [100, 999])).toEqual([]);
  });

  it("requires a supplied product name and rejects a refusal", () => {
    const products = loadCatalogue().filter((product) => product.id === "P01");
    expect(mentionsSuppliedProduct("Keep Biz Fibre 100.", products)).toBe(true);
    expect(mentionsSuppliedProduct("A generic broadband plan.", products)).toBe(false);
    expect(generationUnusable("I can't assist with that request at all, sorry.")).toBe("model refusal");
    expect(generationUnusable("ok")).toBe("generation too short");
  });
});

describe("privacy and persistence", () => {
  it("masks identifiers in log text", () => {
    const masked = redact("saw 37NBLXS1145E1ZU and UDYAM-AP-00-5186772 and SYN-ID-365512");
    expect(masked).not.toContain("37NBLXS1145E1ZU");
    expect(masked).not.toContain("5186772");
    expect(masked).not.toContain("365512");
    expect(maskGstin("37NBLXS1145E1ZU")).toBe("37••••••1ZU");
  });

  const previous = process.env.UDYAM_STORE;
  afterEach(() => {
    process.env.UDYAM_STORE = previous;
  });

  it("keeps an order after a second read", async () => {
    const file = path.join(os.tmpdir(), `udyam-store-${Date.now()}.json`);
    process.env.UDYAM_STORE = file;
    await updateStore((store) => {
      store.orders.AB1 = {
        id: "AB1",
        sessionId: "s",
        handoffCode: "abcd",
        businessName: "Star Electronics",
        city: "Visakhapatnam",
        quote: buildQuote([], loadCatalogue(), { segmentKey: "micro", tier: 2, employees: 1, sites: 1, gstActive: true }),
        paymentRef: "SIM-1",
        status: "work_order_queued",
        events: [],
        createdCaseTime: "2026-07-15T03:30:00.000Z",
      };
      store.sessions.s = {
        id: "s",
        createdCaseTime: "2026-07-15T03:30:00.000Z",
        clock: 0,
        consents: [{ purpose: "discover", version: "udyam-demo-2026-07-15", granted: true, caseTime: tickClock({ clock: 0 }) }],
        advisor: [],
        kyc: [],
        attested: false,
        withdrawn: false,
        handoffCode: "abcd",
        handoffNotes: [],
      };
    });
    const { readStore } = await import("@/lib/store");
    expect(readStore().orders.AB1.status).toBe("work_order_queued");
    fs.rmSync(file, { force: true });
  });
});

describe("ocr", () => {
  it("reads the clear Star Electronics GST specimen", async () => {
    const result = await runOcr(path.join(process.cwd(), "data/kyc_documents/K12_gst_certificate.png"));
    expect(result.text).toContain("Star Electronics");
    expect(result.text).toContain("37NBLXS1145E1ZU");
  }, 30000);

  it("reads the stale Trinity bill date", async () => {
    const result = await runOcr(path.join(process.cwd(), "data/kyc_documents/K11_address_proof.png"));
    expect(result.text).toContain("2025-10-31");
  }, 30000);

  it("does not turn the blurred dental GST image into a passing registry hit", async () => {
    const result = await runOcr(path.join(process.cwd(), "data/kyc_documents/K04_gst_certificate.png"));
    const decision = evaluateDocument("gst", result.text, {
      businessName: "Saffron Dental Care LLP",
      gst: loadGstRegistry(),
      udyam: loadUdyamRegistry(),
    });
    expect(decision.outcome).not.toBe("passed");
  }, 40000);
});
