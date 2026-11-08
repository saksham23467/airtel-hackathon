export type UiLanguage = "en" | "hi";

export type ConsentPurpose = "discover" | "kyc" | "order";

export type Consent = {
  purpose: ConsentPurpose;
  version: string;
  granted: boolean;
  caseTime: string;
};

export type BusinessProfile = {
  personaId: string;
  leadId?: string;
  inSample: boolean;
  businessName: string;
  contactName: string;
  contactRole: string;
  city: string;
  state: string;
  tier: number;
  language: string;
  uiLanguage: UiLanguage;
  segment: string;
  businessType: string;
  employees: number;
  sites: number;
  turnover: string;
  spend: number;
  internet: string;
  provider: string;
  claimsGstin: boolean;
  gstin: string;
  claimsUdyam: boolean;
  udyam: string;
  interests: string[];
  assumptions: string[];
  actualBundle?: string[];
};

export type QuoteLine = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  priceMin: number;
  priceMax: number;
  monthly: number;
  setup: number;
  contractMonths: number;
  installDays: number;
  requiresGstin: boolean;
  deps: string[];
  origin?: "model" | "dependency_base" | "owner";
};

export type Quote = {
  lines: QuoteLine[];
  monthlyPretax: number;
  setupPretax: number;
  monthlyTax: number;
  setupTax: number;
  monthlyWithTax: number;
  setupWithTax: number;
  contractMonths: number;
  installDays: number;
  activationDate: string;
  valid: boolean;
  problems: string[];
  priceRule: string;
  taxNote: string;
};

export type CheckStatus = "pass" | "fail" | "review" | "skipped" | "info";

export type KycCheck = {
  layer: "ocr" | "checksum" | "mock_registry" | "rule" | "human_review";
  label: string;
  status: CheckStatus;
  detail: string;
};

export type DocKind = "gst" | "udyam" | "address" | "signatory";

export type KycEvaluation = {
  kind: DocKind;
  outcome: "passed" | "failed" | "manual_review";
  summary: string;
  checks: KycCheck[];
  fields: Record<string, string>;
};

export type KycDocument = {
  kind: DocKind;
  source: "specimen" | "upload";
  fileName: string;
  storedAs?: string;
  ocrOrientation: number;
  ocrText: string;
  evaluation: KycEvaluation;
};

export type KycReview = {
  decision: "approved" | "rejected";
  note: string;
  caseTime: string;
  actor: "demo-desk";
};

export type AdvisorMessage = {
  role: "owner" | "advisor";
  text: string;
  mode?: "local-generative" | "grounded-composer";
  generative: boolean;
  caseTime: string;
  citations?: { id: string; name: string }[];
  latencyMs?: number | null;
  model?: string | null;
  runtime?: string | null;
  fallbackReason?: string | null;
};

export type OrderEvent = {
  id: string;
  type: string;
  label: string;
  detail: string;
  caseTime: string;
  recordedAt: string;
  simulated: true;
};

export type Order = {
  id: string;
  sessionId: string;
  handoffCode: string;
  businessName: string;
  city: string;
  quote: Quote;
  paymentRef: string;
  status: string;
  events: OrderEvent[];
  createdCaseTime: string;
  /** Wall-clock time the record was stored. Retention uses this, not the case clock. */
  storedAt?: string;
};

export type Session = {
  id: string;
  createdCaseTime: string;
  clock: number;
  consents: Consent[];
  profile?: BusinessProfile;
  recommendation?: unknown;
  quote?: Quote;
  advisor: AdvisorMessage[];
  kyc: KycDocument[];
  attested: boolean;
  review?: KycReview;
  withdrawn: boolean;
  orderId?: string;
  handoffCode: string;
  handoffNotes: { text: string; caseTime: string; role: "partner" }[];
  /** Wall-clock time the record was stored. Retention uses this, not the case clock. */
  storedAt?: string;
};

export type StoreData = {
  sessions: Record<string, Session>;
  orders: Record<string, Order>;
  audit: { event: string; caseTime: string; sessionId?: string; detail?: string }[];
};
