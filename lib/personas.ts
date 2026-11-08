import { cityTier, loadLeads, SEGMENT_KEYS } from "@/lib/catalogue";
import { gstRecordActive } from "@/lib/eligibility";
import { loadGstRegistry } from "@/lib/catalogue";
import type { BusinessProfile } from "@/lib/types";

export type PersonaCard = {
  id: string;
  title: string;
  place: string;
  story: string;
  primary?: boolean;
  tone: "pass" | "fail" | "review" | "rules";
};

type Seed = {
  id: string;
  title: string;
  place: string;
  story: string;
  primary?: boolean;
  tone: PersonaCard["tone"];
  leadId?: string;
  pack?: string;
  draft?: Partial<BusinessProfile> & { city: string; state: string };
};

const seeds: Seed[] = [
  {
    id: "k12",
    title: "Star Electronics",
    place: "Visakhapatnam",
    story: "Clear GST, Udyam, bill and signatory specimens. The recording pass path.",
    primary: true,
    tone: "pass",
    pack: "K12",
    draft: {
      businessName: "Star Electronics",
      contactName: "Pooja Agarwal",
      contactRole: "Owner",
      city: "Visakhapatnam",
      state: "Andhra Pradesh",
      language: "English",
      uiLanguage: "en",
      segment: "Micro retail & services",
      businessType: "Electronics retail",
      employees: 4,
      sites: 1,
      turnover: "< 40 lakh",
      spend: 1800,
      internet: "Mobile hotspot",
      provider: "A phone hotspot",
      claimsGstin: true,
      gstin: "37NBLXS1145E1ZU",
      claimsUdyam: true,
      udyam: "UDYAM-AP-00-5186772",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k11",
    title: "Trinity Bake House",
    place: "Ludhiana",
    story: "The electricity bill is dated 31 Oct 2025, outside the 90-day rule. Hindi interface.",
    primary: true,
    tone: "fail",
    pack: "K11",
    draft: {
      businessName: "Trinity Bake House Pvt Ltd",
      contactName: "Vikram Pillai",
      contactRole: "Owner",
      city: "Ludhiana",
      state: "Punjab",
      language: "Punjabi",
      uiLanguage: "hi",
      segment: "Micro retail & services",
      businessType: "Bakery",
      employees: 8,
      sites: 1,
      turnover: "40 lakh - 1.5 cr",
      spend: 2400,
      internet: "Home broadband",
      provider: "A home connection",
      claimsGstin: true,
      gstin: "03KGZXT1320R1ZZ",
      claimsUdyam: true,
      udyam: "UDYAM-PB-00-9719478",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k01",
    title: "Vindhya Tours",
    place: "Visakhapatnam",
    story: "GSTIN 37IHKXV5167L1ZS is Cancelled on the mock registry. The Udyam number is blank.",
    primary: true,
    tone: "fail",
    pack: "K01",
    draft: {
      businessName: "Vindhya Tours & Travels",
      contactName: "Neha Kaur",
      contactRole: "Office admin",
      city: "Visakhapatnam",
      state: "Andhra Pradesh",
      language: "Telugu",
      uiLanguage: "en",
      segment: "Micro retail & services",
      businessType: "Tours and travel",
      employees: 5,
      sites: 1,
      turnover: "< 40 lakh",
      spend: 1600,
      internet: "Mobile hotspot",
      provider: "A phone hotspot",
      claimsGstin: true,
      gstin: "37IHKXV5167L1ZS",
      claimsUdyam: false,
      udyam: "",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k03",
    title: "Ganesh Woodcraft",
    place: "Nagpur",
    story: "18 employees, tier 2, active GSTIN. Leased line 20 can clear; 100 Mbps leased line and 1 Gbps fibre cannot.",
    primary: true,
    tone: "rules",
    pack: "K03",
    draft: {
      businessName: "Ganesh Woodcraft",
      contactName: "Joseph Singh",
      contactRole: "Owner",
      city: "Nagpur",
      state: "Maharashtra",
      language: "Marathi",
      uiLanguage: "en",
      segment: "Small manufacturers",
      businessType: "Wood workshop",
      employees: 18,
      sites: 1,
      turnover: "40 lakh - 1.5 cr",
      spend: 7000,
      internet: "Business broadband",
      provider: "A local broadband line",
      claimsGstin: true,
      gstin: "27XUIXG0767D1ZP",
      claimsUdyam: true,
      udyam: "UDYAM-MH-00-9516696",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k07",
    title: "Neelgiri Physio",
    place: "Delhi",
    story: "Trade name matches the mock registry. The certificate legal name says Shri Physio Clinic; the registry says Neelgiri.",
    tone: "review",
    pack: "K07",
    draft: {
      businessName: "Neelgiri Physio Clinic",
      contactName: "Neha Banerjee",
      contactRole: "Manager",
      city: "Delhi",
      state: "Delhi",
      language: "Hindi",
      uiLanguage: "en",
      segment: "Professional offices",
      businessType: "Physiotherapy clinic",
      employees: 6,
      sites: 1,
      turnover: "40 lakh - 1.5 cr",
      spend: 2200,
      internet: "Home broadband",
      provider: "A home connection",
      claimsGstin: true,
      gstin: "07CPCXN0398P1ZT",
      claimsUdyam: true,
      udyam: "UDYAM-DL-00-9565547",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k06",
    title: "Saffron Unisex Salon",
    place: "Jaipur",
    story: "The number printed on the GST specimen fails the checksum. A different active GSTIN for this trade name is not auto-linked.",
    tone: "fail",
    pack: "K06",
    draft: {
      businessName: "Saffron Unisex Salon",
      contactName: "Pooja Shah",
      contactRole: "Owner",
      city: "Jaipur",
      state: "Rajasthan",
      language: "English",
      uiLanguage: "en",
      segment: "Micro retail & services",
      businessType: "Salon",
      employees: 3,
      sites: 1,
      turnover: "< 40 lakh",
      spend: 1200,
      internet: "Home broadband",
      provider: "A home connection",
      claimsGstin: true,
      gstin: "08YKZXS8189L1Z0",
      claimsUdyam: true,
      udyam: "UDYAM-RJ-00-6577157",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k04",
    title: "Saffron Dental Care",
    place: "Nagpur",
    story: "The GST specimen is too blurred to read. Udyam is present. Expect a manual-review queue, not a guessed GSTIN.",
    tone: "review",
    pack: "K04",
    draft: {
      businessName: "Saffron Dental Care LLP",
      contactName: "Fatima Pillai",
      contactRole: "Partner",
      city: "Nagpur",
      state: "Maharashtra",
      language: "Hindi",
      uiLanguage: "en",
      segment: "Professional offices",
      businessType: "Dental clinic",
      employees: 9,
      sites: 1,
      turnover: "40 lakh - 1.5 cr",
      spend: 3500,
      internet: "Business broadband",
      provider: "A clinic broadband line",
      claimsGstin: true,
      gstin: "",
      claimsUdyam: true,
      udyam: "UDYAM-MH-00-6131836",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "k02",
    title: "Harmony Dental Care",
    place: "Kolkata",
    story: "The GST scan is skewed. OCR is expected to miss it and leave a manual review, not a transcribed guess.",
    tone: "review",
    pack: "K02",
    draft: {
      businessName: "Harmony Dental Care",
      contactName: "Joseph Shah",
      contactRole: "Manager",
      city: "Kolkata",
      state: "West Bengal",
      language: "Bengali",
      uiLanguage: "en",
      segment: "Professional offices",
      businessType: "Dental clinic",
      employees: 7,
      sites: 1,
      turnover: "40 lakh - 1.5 cr",
      spend: 2800,
      internet: "Business broadband",
      provider: "A clinic broadband line",
      claimsGstin: true,
      gstin: "",
      claimsUdyam: true,
      udyam: "UDYAM-WB-00-5053330",
      interests: [],
      assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment"],
    },
  },
  {
    id: "l00024",
    title: "Blue Lotus Kitchens",
    place: "Kolkata · lead L00024",
    story: "Every profile field is the CSV row. The saved model was fit on all activated leads, so this score is in-sample. There is no specimen pack.",
    tone: "rules",
    leadId: "L00024",
  },
];

export function personaCards(): PersonaCard[] {
  return seeds.map(({ id, title, place, story, primary, tone }) => ({ id, title, place, story, primary, tone }));
}

export function personaPack(id: string): string | undefined {
  return seeds.find((seed) => seed.id === id)?.pack;
}

export function materialisePersona(id: string): BusinessProfile {
  const seed = seeds.find((item) => item.id === id);
  if (!seed) throw new Error("Unknown persona");
  if (seed.leadId) {
    const row = loadLeads().find((lead) => lead.lead_id === seed.leadId);
    if (!row) throw new Error("Lead missing");
    const bundle = (row.bundle_products || "")
      .split(";")
      .filter(Boolean)
      .map((part) => part.split("x")[0]);
    return {
      personaId: id,
      leadId: row.lead_id,
      inSample: true,
      businessName: row.business_name,
      contactName: row.contact_name,
      contactRole: row.contact_role,
      city: row.city,
      state: row.state,
      tier: Number(row.city_tier),
      language: row.preferred_language,
      uiLanguage: "en",
      segment: row.segment,
      businessType: row.business_type,
      employees: Number(row.employee_count),
      sites: Number(row.num_sites),
      turnover: row.annual_turnover_band,
      spend: Number(row.monthly_telecom_spend_inr),
      internet: row.current_internet,
      provider: row.current_provider,
      claimsGstin: row.has_gstin === "Y",
      gstin: row.gstin,
      claimsUdyam: row.has_udyam === "Y",
      udyam: row.udyam_number,
      interests: row.products_of_interest ? row.products_of_interest.split(";").filter(Boolean) : [],
      assumptions: [],
      actualBundle: bundle,
    };
  }
  const draft = seed.draft!;
  const tier = cityTier(draft.city);
  if (tier == null) throw new Error(`City tier for ${draft.city} is not unanimous in smb_leads.csv`);
  return {
    personaId: id,
    inSample: false,
    businessName: draft.businessName || "",
    contactName: draft.contactName || "",
    contactRole: draft.contactRole || "",
    city: draft.city,
    state: draft.state,
    tier,
    language: draft.language || "English",
    uiLanguage: draft.uiLanguage || "en",
    segment: draft.segment || "Micro retail & services",
    businessType: draft.businessType || "",
    employees: draft.employees || 1,
    sites: draft.sites || 1,
    turnover: draft.turnover || "< 40 lakh",
    spend: draft.spend || 0,
    internet: draft.internet || "None",
    provider: draft.provider || "",
    claimsGstin: Boolean(draft.claimsGstin),
    gstin: draft.gstin || "",
    claimsUdyam: Boolean(draft.claimsUdyam),
    udyam: draft.udyam || "",
    interests: draft.interests || [],
    assumptions: draft.assumptions || [],
  };
}

export function blankProfile(): BusinessProfile {
  return {
    personaId: "blank",
    inSample: false,
    businessName: "",
    contactName: "",
    contactRole: "Owner",
    city: "Jaipur",
    state: "Rajasthan",
    tier: cityTier("Jaipur") || 2,
    language: "Hindi",
    uiLanguage: "en",
    segment: "Micro retail & services",
    businessType: "",
    employees: 3,
    sites: 1,
    turnover: "< 40 lakh",
    spend: 1000,
    internet: "Mobile hotspot",
    provider: "",
    claimsGstin: false,
    gstin: "",
    claimsUdyam: false,
    udyam: "",
    interests: [],
    assumptions: ["employees", "sites", "turnover", "spend", "internet", "segment", "city"],
  };
}

export function gstActiveForProfile(profile: BusinessProfile): boolean {
  return gstRecordActive(profile.gstin, loadGstRegistry());
}

export function segmentKey(segment: string): string {
  return SEGMENT_KEYS[segment] || segment;
}
