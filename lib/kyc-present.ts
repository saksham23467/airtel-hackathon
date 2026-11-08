import type { KycCheck, KycEvaluation, UiLanguage } from "@/lib/types";

const LABELS: Record<string, string> = {
  "GSTIN token": "जीएसटीआईएन टोकन",
  "GSTIN checksum": "जीएसटीआईएन चेकसम",
  "Mock GST registry": "मॉक जीएसटी रजिस्ट्री",
  "Trade name": "ट्रेड नाम",
  "Legal name": "कानूनी नाम",
  Authorisation: "अधिकृति",
  "Udyam number": "उद्यम नंबर",
  "Udyam format": "उद्यम प्रारूप",
  "Mock Udyam registry": "मॉक उद्यम रजिस्ट्री",
  "Enterprise name": "उद्यम का नाम",
  "Bill date": "बिल की तारीख",
  "Bill age": "बिल की उम्र",
  "Billed name": "बिल पर नाम",
  "Mock registry": "मॉक रजिस्ट्री",
  Checksum: "चेकसम",
  "Signatory card": "हस्ताक्षरकर्ता कार्ड",
  "Specimen ID number": "नमूना पहचान संख्या",
  "ID pattern": "पहचान का पैटर्न",
  Validity: "वैधता",
  "Business on card": "कार्ड पर व्यवसाय",
};

function hiDetail(detail: string): string {
  const rules: [RegExp, string][] = [
    [/OCR, format checks, and the rules that apply to this document passed\./, "ओसीआर, प्रारूप और लागू नियम इस दस्तावेज़ पर पास हुए।"],
    [/No GSTIN token was found beside a GSTIN label\. The scan is queued for a person\./, "जीएसटीआईएन लेबल के पास टोकन नहीं मिला। स्कैन व्यक्ति की कतार में है।"],
    [/Checksum waits for a token\./, "चेकसम टोकन का इंतज़ार करता है।"],
    [/Registry lookup waits for a checksum-valid reading\./, "रजिस्ट्री जाँच वैध चेकसम का इंतज़ार करती है।"],
    [/Lookup waits for a checksum-valid reading\. A similar trade name is not substituted\./, "लुकअप वैध चेकसम का इंतज़ार करता है। मिलता-जुलता ट्रेड नाम नहीं लगाया जाता।"],
    [/Checksum accepted the OCR token as read\./, "चेकसम ने ओसीआर टोकन को जैसा पढ़ा वैसा स्वीकार किया।"],
    [/is checksum-valid and absent from the mock registry\./, "चेकसम वैध है और मॉक रजिस्ट्री में नहीं है।"],
    [/Mock registry status for (.+) is (.+)\./, "मॉक रजिस्ट्री में $1 की स्थिति $2 है।"],
    [/OCR trade name aligns with the mock registry trade name\./, "ओसीआर ट्रेड नाम मॉक रजिस्ट्री से मेल खाता है।"],
    [/OCR legal name aligns with the mock registry legal name\./, "ओसीआर कानूनी नाम मॉक रजिस्ट्री के कानूनी नाम से मेल खाता है।"],
    [/does not align with the mock registry legal name/, "मॉक रजिस्ट्री के कानूनी नाम से मेल नहीं खाता। व्यक्ति की कतार में है।"],
    [/The certificate is readable and the Udyam number is blank\./, "प्रमाणपत्र पढ़ा गया और उद्यम नंबर खाली है।"],
    [/No Udyam number could be read\. The scan is queued for a person\./, "उद्यम नंबर नहीं पढ़ा गया। स्कैन व्यक्ति की कतार में है।"],
    [/Format matches UDYAM-SS-DD-NNNNNNN\. District 00 is the synthetic marker in this pack and is accepted\./, "प्रारूप UDYAM-SS-DD-NNNNNNN से मेल खाता है। ज़िला 00 इस पैक का सिंथेटिक चिह्न है और स्वीकार है।"],
    [/is not in the mock Udyam registry\./, "मॉक उद्यम रजिस्ट्री में नहीं है।"],
    [/This is a local file\./, "यह स्थानीय फाइल है।"],
    [/The bill is (\d+) days before 15 July 2026\. Address proof must be no older than 90 days\./, "बिल 15 जुलाई 2026 से $1 दिन पुराना है। पते का प्रमाण 90 दिन से नया होना चाहिए।"],
    [/The bill is (\d+) days before 15 July 2026, inside the 90-day rule\./, "बिल 15 जुलाई 2026 से $1 दिन पहले का है, 90 दिन के नियम के अंदर।"],
    [/The bill date is after the case clock of 15 July 2026\./, "बिल की तारीख केस घड़ी 15 जुलाई 2026 के बाद की है।"],
    [/The billed name aligns with the business name on this journey\./, "बिल का नाम इस यात्रा के व्यवसाय से मेल खाता है।"],
    [/Address proof is not a GSTIN or Udyam lookup\./, "पते का प्रमाण जीएसटीआईएन या उद्यम लुकअप नहीं है।"],
    [/Address proof has no identifier checksum in this demo\./, "इस डेमो में पते के प्रमाण का चेकसम नहीं है।"],
    [/A SYN-ID number was read\. It is masked outside this step\./, "SYN-ID पढ़ा गया। इस चरण के बाहर यह छिपा रहता है।"],
    [/The number matches the synthetic SYN-ID-###### pattern\. It is not a government ID checksum\./, "नंबर सिंथेटिक SYN-ID पैटर्न से मेल खाता है। यह सरकारी पहचान का चेकसम नहीं है।"],
    [/Valid till (.+), on or after the case clock\./, "$1 तक वैध है, केस घड़ी पर या उसके बाद।"],
    [/The card expired on (.+), before 15 July 2026\./, "कार्ड $1 को समाप्त हो चुका है, 15 जुलाई 2026 से पहले।"],
    [/The business on the card aligns with this journey\./, "कार्ड का व्यवसाय इस यात्रा से मेल खाता है।"],
    [/The image does not look like a readable signatory card\./, "चित्र पढ़ने योग्य हस्ताक्षरकर्ता कार्ड नहीं लगता। व्यक्ति की कतार में है।"],
    [/The card looks readable and has no SYN-ID number\./, "कार्ड पढ़ा गया और SYN-ID नहीं है।"],
    [/No expiry date was read\./, "समाप्ति तारीख नहीं पढ़ी गई।"],
    [/Still needed: (.+)\./, "अभी बाकी: $1।"],
    [/All four documents passed the automated checks on this demo\./, "इस डेमो पर चारों दस्तावेज़ की स्वचालित जाँच पास हुई।"],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(detail)) return detail.replace(pattern, replacement);
  }
  return detail;
}

export function presentEvaluation(evaluation: KycEvaluation, lang: UiLanguage): KycEvaluation {
  if (lang !== "hi") return evaluation;
  const checks: KycCheck[] = evaluation.checks.map((check) => ({
    ...check,
    label: LABELS[check.label] || check.label,
    detail: hiDetail(check.detail),
  }));
  return { ...evaluation, summary: hiDetail(evaluation.summary), checks };
}

export function presentGate(gate: { status: string; reasons: string[] }, lang: UiLanguage) {
  if (lang !== "hi") return gate;
  return { ...gate, reasons: gate.reasons.map((reason) => hiDetail(reason)) };
}
