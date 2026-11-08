export type PersonaCard = {
  id: string;
  title: string;
  place: string;
  story: string;
  primary?: boolean;
  tone: "pass" | "fail" | "review" | "rules";
};

export const personaCards: PersonaCard[] = [
  { id: "k12", title: "Star Electronics", place: "Visakhapatnam", primary: true, tone: "pass", story: "Clear GST, Udyam, bill and signatory specimens. The recording pass path." },
  { id: "k11", title: "Trinity Bake House", place: "Ludhiana", primary: true, tone: "fail", story: "The electricity bill is dated 31 Oct 2025, outside the 90-day rule. Hindi interface." },
  { id: "k01", title: "Vindhya Tours", place: "Visakhapatnam", primary: true, tone: "fail", story: "The GSTIN is Cancelled on the mock registry. The Udyam number on the certificate is blank." },
  { id: "k03", title: "Ganesh Woodcraft", place: "Nagpur", primary: true, tone: "rules", story: "18 employees and tier 2. Leased line 20 can clear; 100 Mbps leased line and 1 Gbps fibre cannot." },
  { id: "k07", title: "Neelgiri Physio", place: "Delhi", tone: "review", story: "Trade name matches the mock registry. The certificate legal name says Shri; the registry says Neelgiri." },
  { id: "k06", title: "Saffron Unisex Salon", place: "Jaipur", tone: "fail", story: "The GST number printed on the specimen fails the checksum and is not swapped for another record." },
  { id: "k04", title: "Saffron Dental Care", place: "Nagpur", tone: "review", story: "The GST specimen is too blurred to read. Expect a person to review it." },
  { id: "k02", title: "Harmony Dental Care", place: "Kolkata", tone: "review", story: "The GST scan is skewed. OCR is expected to leave it for a person." },
  { id: "l00024", title: "Blue Lotus Kitchens", place: "Kolkata · lead L00024", tone: "rules", story: "Profile fields come from the lead file. The saved model has seen this activated lead, so the score is in-sample." },
];
