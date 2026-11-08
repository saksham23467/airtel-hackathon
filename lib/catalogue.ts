import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { dataRoot } from "@/lib/paths";

export type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setup: number;
  contractMonths: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  deps: string[];
  installDays: number;
  segments: string[];
};

export type LeadRow = Record<string, string>;
export type GstRecord = {
  gstin: string;
  legal_name: string;
  trade_name: string;
  constitution: string;
  principal_place_of_business: string;
  state: string;
  registration_date: string;
  status: string;
};
export type UdyamRecord = {
  udyam_number: string;
  enterprise_name: string;
  enterprise_type: string;
  major_activity: string;
  nic_description: string;
  state: string;
  city: string;
  date_of_registration: string;
};

let catalogueCache: Product[] | null = null;
let leadCache: LeadRow[] | null = null;
let gstCache: Map<string, GstRecord> | null = null;
let udyamCache: Map<string, UdyamRecord> | null = null;

function readRows(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(path.join(dataRoot(), file), "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true }) as Record<string, string>[];
}

export function loadCatalogue(): Product[] {
  if (catalogueCache) return catalogueCache;
  catalogueCache = readRows("product_catalogue.csv").map((row) => ({
    id: row.product_id,
    category: row.category,
    name: row.product_name,
    description: row.description,
    unit: row.unit,
    priceMin: Number(row.price_min_inr_per_month),
    priceMax: Number(row.price_max_inr_per_month),
    setup: Number(row.one_time_setup_inr),
    contractMonths: Number(row.min_contract_months),
    tiers: row.available_city_tiers.split(";").filter(Boolean).map(Number),
    minEmployees: Number(row.min_employees),
    minSites: Number(row.min_sites),
    requiresGstin: row.requires_gstin === "Y",
    deps: row.requires_one_of ? row.requires_one_of.split("|").filter(Boolean) : [],
    installDays: Number(row.typical_install_days),
    segments: row.target_segments ? row.target_segments.split(";") : [],
  }));
  return catalogueCache;
}

export function productMap(): Map<string, Product> {
  return new Map(loadCatalogue().map((product) => [product.id, product]));
}

export function loadLeads(): LeadRow[] {
  if (!leadCache) leadCache = readRows("smb_leads.csv");
  return leadCache;
}

export function loadGstRegistry(): Map<string, GstRecord> {
  if (!gstCache) {
    gstCache = new Map(readRows("mock_gstin_registry.csv").map((row) => [row.gstin, row as GstRecord]));
  }
  return gstCache;
}

export function loadUdyamRegistry(): Map<string, UdyamRecord> {
  if (!udyamCache) {
    udyamCache = new Map(readRows("mock_udyam_registry.csv").map((row) => [row.udyam_number, row as UdyamRecord]));
  }
  return udyamCache;
}

export function cityTier(city: string): number | null {
  const tiers = new Set(loadLeads().filter((row) => row.city === city).map((row) => row.city_tier));
  if (tiers.size !== 1) return null;
  return Number([...tiers][0]);
}

export const SEGMENT_KEYS: Record<string, string> = {
  "Micro retail & services": "micro",
  "Professional offices": "prof",
  "Small multi-site businesses": "multi",
  "Small manufacturers": "mfg",
};

export const TURNOVER_BANDS = ["< 40 lakh", "40 lakh - 1.5 cr", "1.5 - 5 cr", "5 - 25 cr", "25 - 100 cr"];

export const INTERNET_OPTIONS = [
  "Business broadband",
  "Mobile hotspot",
  "Mixed per site",
  "Leased line",
  "Home broadband",
  "None",
];
