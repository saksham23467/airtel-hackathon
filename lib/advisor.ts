import type { Product } from "@/lib/catalogue";
import { eligibilityReasons, type ScoreProfile } from "@/lib/eligibility";
import { inr } from "@/lib/format";
import { claimProblems, statedBudget, type ClaimContext } from "@/lib/grounding";
import { addDays, CASE_TODAY } from "@/lib/gstin";
import { gstActiveForProfile, segmentKey } from "@/lib/personas";
import type { BusinessProfile, Quote, QuoteLine, UiLanguage } from "@/lib/types";

export type AdviceIntent = "price" | "internet" | "incumbent" | "install" | "contract" | "paper" | "discovery" | "injection" | "generic";

export type Advice = {
  mode: "local-generative" | "grounded-composer";
  generative: boolean;
  disclosure: string;
  text: string;
  citations: { id: string; name: string }[];
  latencyMs: number | null;
  model: string | null;
  runtime: string | null;
  fallbackReason: string | null;
  intent: AdviceIntent;
};

export type AdviceInput = {
  message: string;
  profile: BusinessProfile;
  quote: Quote | null;
  products: Product[];
  focusIds: string[];
};

const DISCLOSURE = {
  en: "Deterministic fallback. This reply was not produced by a generative model. Figures are catalogue fields, the saved quote, or a number you entered.",
  hi: "यह नियतात्मक फ़ॉलबैक है। जवाब जनरेटिव मॉडल का नहीं है। आंकड़े कैटलॉग, सेव कोट, या आपके दर्ज नंबर से हैं।",
};

const BROADBAND_ORDER = ["P01", "P04", "P02", "P03", "P05", "P06"];

export function replyLanguage(message: string, profileLanguage: "en" | "hi"): "en" | "hi" {
  const devanagari = message.match(/\p{Script=Devanagari}/gu)?.length ?? 0;
  if (devanagari >= 8) return "hi";
  return profileLanguage === "hi" ? "hi" : "en";
}

export function detectIntent(message: string): AdviceIntent {
  const text = message.toLowerCase();
  if (/ignore\s+(all\s+|any\s+)?(previous|prior|above|instructions)|system\s+prompt|you\s+are\s+now|jailbreak|developer\s+message|reveal\s+(the\s+)?(key|secret|prompt)|disregard\s+(the\s+)?(rules|instructions)|demo_desk_key|udyam-demo\b/i.test(message)) {
    return "injection";
  }
  if (/only (?:need )?internet|just (?:need )?internet|need only internet|internet only|sirf internet|broadband only|fibre only|fiber only|बस इंटरनेट|केवल इंटरनेट|सिर्फ इंटरनेट|सिर्फ़ इंटरनेट/.test(text)) return "internet";
  if (/install|delay|how long|इंस्टॉल|कितने दिन|दिन लग/.test(text)) return "install";
  if (/contract|lock-in|lock in|अनुबंध/.test(text)) return "contract";
  if (/paper|kyc|document|कागज|दस्तावेज|झंझट/.test(text)) return "paper";
  if (/already|existing provider|current provider|competitor|local isp|पहले से|प्रदाता/.test(text)) return "incumbent";
  if (/expensive|price|cost|budget|mahnga|mehnga|महंग|कीमत|सस्त|बजट/.test(text)) return "price";
  if (/^(hi|hello|hey|help|suggest|advice|start|नमस्ते|मदद|सलाह|बताओ|सुझाव)\b/.test(text.trim()) || text.trim().length < 8 || /what should i (buy|get)|what do i need|recommend something|क्या लूँ|क्या चाहिए|कोई सुझाव/.test(text)) {
    return "discovery";
  }
  return "generic";
}

function scoreFor(profile: BusinessProfile): ScoreProfile {
  return {
    segmentKey: segmentKey(profile.segment),
    tier: profile.tier,
    employees: profile.employees,
    sites: profile.sites,
    gstActive: gstActiveForProfile(profile),
  };
}

function namedProducts(message: string, products: Product[]): Product[] {
  const text = message.toLowerCase();
  return products.filter((product) => text.includes(product.id.toLowerCase()) || text.includes(product.name.toLowerCase()));
}

function isBroadbandBase(product: Product): boolean {
  if (product.category !== "Connectivity" || product.deps.length > 0) return false;
  return /fibre|fiber|broadband|leased|airfiber|fwa/i.test(`${product.name} ${product.description}`);
}

function byBroadband(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const ia = BROADBAND_ORDER.indexOf(a.id);
    const ib = BROADBAND_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function lookup(products: Product[], ids: string[]): Product[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
}

function selectFocus(input: AdviceInput, intent: AdviceIntent, score: ScoreProfile): { focus: Product[]; excluded: QuoteLine[] } {
  const named = namedProducts(input.message, input.products);
  const eligibleBroadband = byBroadband(
    input.products.filter((product) => isBroadbandBase(product) && eligibilityReasons(score, product).length === 0),
  );
  const quoteLines = input.quote?.lines || [];
  const quoteProducts = lookup(input.products, quoteLines.map((line) => line.id));
  if (intent === "injection" || intent === "discovery" || intent === "paper") return { focus: [], excluded: [] };
  if (intent === "internet") {
    const namedBroadband = named.filter((product) => product.category === "Connectivity");
    const preferred = eligibleBroadband.filter((product) => product.segments.includes(score.segmentKey));
    const focus = (namedBroadband.length ? namedBroadband : preferred.length ? preferred : eligibleBroadband).slice(0, 3);
    const excluded = quoteLines.filter((line) => {
      const product = input.products.find((item) => item.id === line.id);
      return !product || product.category !== "Connectivity";
    });
    return { focus, excluded };
  }
  if (named.length) return { focus: named.slice(0, 3), excluded: [] };
  if (quoteProducts.length && intent !== "install") return { focus: quoteProducts.slice(0, 4), excluded: [] };
  if (quoteProducts.length && intent === "install") return { focus: quoteProducts.slice(0, 4), excluded: [] };
  if (intent === "install" || intent === "price" || intent === "generic") return { focus: eligibleBroadband.slice(0, 3), excluded: [] };
  const focused = lookup(input.products, input.focusIds);
  return { focus: (focused.length ? focused : eligibleBroadband).slice(0, 3), excluded: [] };
}

function unitHi(unit: string): string {
  const names: Record<string, string> = {
    "per site": "साइट",
    "per line": "लाइन",
    "per user": "उपयोगकर्ता",
    "per counter": "काउंटर",
    "per camera": "कैमरा",
    "per device": "डिवाइस",
    "per vehicle": "वाहन",
    "per IP": "आईपी",
    "per channel": "चैनल",
    "per number": "नंबर",
    "per pack": "पैक",
    "per account": "अकाउंट",
  };
  return names[unit] || unit;
}

function dataClause(product: Product, lang: UiLanguage): string {
  if (/unlimited data/i.test(product.description)) {
    return lang === "hi"
      ? `${product.name} के कैटलॉग वाक्य में अनलिमिटेड डेटा लिखा है।`
      : `${product.name} catalogue text says unlimited data.`;
  }
  const gb = product.description.match(/(\d+)\s*GB/i);
  if (gb) {
    return lang === "hi" ? `${product.name} की कैटलॉग डेटा सीमा ${gb[1]} GB है।` : `${product.name} catalogue data allowance is ${gb[1]} GB.`;
  }
  return lang === "hi" ? `${product.name} की पंक्ति कोई डेटा पैक नहीं बताती।` : `${product.name} states no data allowance in the catalogue.`;
}

function eligibilityNote(product: Product, score: ScoreProfile, lang: UiLanguage): string {
  const reasons = eligibilityReasons(score, product);
  if (!reasons.length) return "";
  if (lang === "en") return `${product.name} is not eligible. ${reasons.join(" ")}`;
  const hindi: string[] = [];
  if (!product.tiers.includes(score.tier)) hindi.push(`टियर ${score.tier} पर नहीं बिकता। कैटलॉग टियर ${product.tiers.join(" और ")} लिखता है।`);
  if (score.employees < product.minEmployees) hindi.push(`कम से कम ${product.minEmployees} कर्मचारी चाहिए। यहाँ ${score.employees} हैं।`);
  if (score.sites < product.minSites) hindi.push(`कम से कम ${product.minSites} साइट चाहिए। यहाँ ${score.sites} हैं।`);
  if (product.requiresGstin && !score.gstActive) hindi.push("सक्रिय जीएसटीआईएन चाहिए। दिया गया नंबर मॉक रजिस्ट्री में सक्रिय नहीं है।");
  return `${product.name} अभी पात्र नहीं है। ${hindi.join(" ")}`;
}

function productParagraph(product: Product, qty: number, score: ScoreProfile, profile: BusinessProfile, bench: number, lang: UiLanguage): string {
  const monthly = product.priceMin * qty;
  const setup = product.setup * qty;
  const date = addDays(CASE_TODAY, product.installDays);
  const unit = lang === "hi" ? unitHi(product.unit) : product.unit;
  const relation = monthly <= bench
    ? lang === "hi" ? "कम या बराबर" : "at or below"
    : lang === "hi" ? "अधिक" : "above";
  const money = lang === "hi"
    ? `${product.name} का मासिक फ़्लोर ${inr(product.priceMin)} प्रति ${unit} है, बैंड ${inr(product.priceMax)} तक। मात्रा ${qty} पर फ़्लोर योग ${inr(monthly)} है। ${product.name} का सेटअप ${inr(setup)} है। ${product.name} का फ़्लोर योग ${inr(monthly)} दर्ज आंकड़े ${inr(bench)} से ${relation} है।`
    : `${product.name} has a monthly floor of ${inr(product.priceMin)} ${unit}, band to ${inr(product.priceMax)}. At quantity ${qty} the floor total is ${inr(monthly)}. ${product.name} setup is ${inr(setup)}. ${product.name} floor total ${inr(monthly)} is ${relation} the typed figure ${inr(bench)}.`;
  const time = lang === "hi"
    ? `${product.name} का न्यूनतम अनुबंध ${product.contractMonths} महीने है। ${product.name} का सामान्य इंस्टॉल ${product.installDays} दिन है। सबसे धीमी लाइन यही हो तो योजना तिथि ${date} है।`
    : `${product.name} has a minimum contract of ${product.contractMonths} month${product.contractMonths === 1 ? "" : "s"}. ${product.name} typical install is ${product.installDays} day${product.installDays === 1 ? "" : "s"}. The planning date is ${date} if this is the slowest line.`;
  const dependency = product.deps.length
    ? lang === "hi"
      ? `${product.name} को इनमें से एक आधार चाहिए: ${product.deps.join(", ")}।`
      : `${product.name} needs one of these base products: ${product.deps.join(", ")}.`
    : lang === "hi"
      ? `${product.name} अकेले कोट में रह सकता है।`
      : `${product.name} can stand alone in a quote.`;
  const targeted = product.segments.includes(segmentKey(profile.segment));
  const target = lang === "hi"
    ? targeted
      ? "कैटलॉग के लक्षित सेगमेंट में यह व्यवसाय आता है। यह पात्रता की रोक नहीं है।"
      : "कैटलॉग के लक्षित सेगमेंट में यह व्यवसाय नहीं है। यह पात्रता की रोक नहीं है। रोक केवल टियर, कर्मचारी, साइट और सक्रिय जीएसटीआईएन से लगती है।"
    : targeted
      ? "The catalogue target segments include this business. That is a targeting note, not an eligibility block."
      : "The catalogue target segments do not list this business. That is a targeting note, not an eligibility block. Blocks are city tier, employees, sites and an active GSTIN.";
  const gate = eligibilityNote(product, score, lang);
  return [dataClause(product, lang), money, time, dependency, target, gate].filter(Boolean).join(" ");
}

function quoteQty(quote: Quote | null, id: string): number {
  return quote?.lines.find((line) => line.id === id)?.qty ?? 1;
}

function formsNote(lang: UiLanguage): string {
  return lang === "hi"
    ? "ज़रूरत, साइट और खर्च व्यवसाय फॉर्म पर बदलें, और लाइनें कोट चरण पर। यह बातचीत उन फॉर्म की जगह नहीं लेती।"
    : "Change needs, sites and spend on the business form, and lines on the quote step. This chat does not replace those forms.";
}

function uncertainty(lang: UiLanguage): string {
  return lang === "hi"
    ? "ये कैटलॉग फ़ील्ड हैं। यह साइट सर्वे नहीं, सरकारी रजिस्ट्री नहीं, और असली बिल का ऑडिट नहीं है। 18% की लाइन केवल प्रदर्शन के लिए है।"
    : "These are catalogue fields. This is not a site survey, a government registry check, or an audit of a real bill. The 18% line is illustrative only.";
}

function spendCompare(quote: Quote, bench: number, stated: number | null, lang: UiLanguage): string {
  const label = stated != null
    ? lang === "hi" ? "संदेश में लिखे बजट" : "the budget written in the message"
    : lang === "hi" ? "फॉर्म में दर्ज खर्च" : "the telecom spend entered on the form";
  const relation = quote.monthlyPretax <= bench
    ? lang === "hi" ? "कम या बराबर" : "at or below"
    : lang === "hi" ? "अधिक" : "above";
  return lang === "hi"
    ? `सेव कोट कर से पहले मासिक ${inr(quote.monthlyPretax)} है और सेटअप ${inr(quote.setupPretax)} है। उदाहरण कर ${inr(quote.monthlyTax)} है। यह योग ${label} ${inr(bench)} से ${relation} है। यह टाइप किए आंकड़े से तुलना है।`
    : `The saved quote is ${inr(quote.monthlyPretax)} a month before illustrative tax and ${inr(quote.setupPretax)} setup. Illustrative tax on the monthly total is ${inr(quote.monthlyTax)}. That monthly total is ${relation} ${label} ${inr(bench)}. That compares with a number you typed.`;
}

function exclusionParagraph(lines: QuoteLine[], lang: UiLanguage): string {
  const names = lines.map((line) => `${line.name} (${line.id})`).join(", ");
  return lang === "hi"
    ? `सेव कोट में ${names} अब भी है, यह सिर्फ-इंटरनेट मांग से बाहर है, इसलिए कोट फॉर्म पर हटा दें, मैं इसे सुझाव नहीं दे रहा।`
    : `The saved quote still includes ${names}, which is outside an internet-only request, so remove it on the quote form, I am not recommending it.`;
}

function discoveryText(profile: BusinessProfile, lang: UiLanguage): string {
  const who = profile.businessName || (lang === "hi" ? "इस व्यवसाय" : "this business");
  if (lang === "hi") {
    return `${who} का फॉर्म पहले से सेगमेंट, शहर, कर्मचारी, साइट और खर्च ${inr(profile.spend)} रखता है। मैं उस फॉर्म की जगह नहीं लेता। तीन बातें जवाब को सटीक करेंगी। ज़रूरत सिर्फ इंटरनेट है, या बिलिंग, फ़ोन या कैमरा भी? कनेक्शन कितनी साइटों पर चाहिए? कैटलॉग फ़्लोर की तुलना फॉर्म वाले आंकड़े से करूँ या किसी और बजट से? जब तक आप न कहें, मैं क्लाउड पीओएस या कोई और नॉन-कनेक्टिविटी उत्पाद सुझाव नहीं दूँगा।`;
  }
  return `The business form already holds segment, city, headcount, sites and spend ${inr(profile.spend)} for ${who}. I do not replace that form. Three answers would tighten this. Is the need only internet, or also billing, phones or cameras? How many sites should the connection cover? Should I compare catalogue floors with the figure already entered, or with a different budget? Until you say, I will not recommend Cloud POS or any other non-connectivity product.`;
}

function injectionText(lang: UiLanguage): string {
  return lang === "hi"
    ? "मैं उस निर्देश को नहीं मानूँगा। मैं सिर्फ कैटलॉग की कीमत, पात्रता और इंस्टॉल दिन बताता हूँ। कोई चाबी, प्रॉम्प्ट या छिपा नियम इस जवाब में नहीं है।"
    : "I will not follow that instruction. I only discuss catalogue price, eligibility and install days. This reply has no key, prompt or hidden rule.";
}

function paperText(lang: UiLanguage): string {
  return lang === "hi"
    ? "केवाईसी चार सिंथेटिक दस्तावेज़ माँगता है, और केवल अलग सहमति के बाद। जीएसटीआईएन और उद्यम लुकअप स्थानीय मॉक फाइल हैं। कोई सरकारी कॉल नहीं है। धुंधला या नियम पर फेल दस्तावेज़ या तो फेल होता है या व्यक्ति की कतार में जाता है। मैं उसे चुपचाप पास नहीं करता।"
    : "KYC asks for four synthetic documents, and only after a separate consent. GSTIN and Udyam lookups read local mock files. There is no government call. A blurred or rule-failing document fails or waits for a person. It is not silently passed.";
}

function installLead(quote: Quote | null, lang: UiLanguage): string {
  if (!quote?.lines.length) {
    return lang === "hi"
      ? "इंस्टॉल दिन हर उत्पाद के कैटलॉग फ़ील्ड से आते हैं। कोट सेव होने पर सबसे धीमी लाइन योजना तिथि तय करती है। यह फील्ड अपॉइंटमेंट नहीं है।"
      : "Install days come from each product's typical_install_days field. Once a quote is saved, the slowest line sets the planning date. That date is not a field appointment.";
  }
  const slowest = [...quote.lines].sort((a, b) => b.installDays - a.installDays || a.id.localeCompare(b.id))[0];
  return lang === "hi"
    ? `इस कोट की सबसे धीमी लाइन ${slowest.name} है, कैटलॉग के ${slowest.installDays} सामान्य दिन। योजना तिथि ${quote.activationDate} है, केस घड़ी ${CASE_TODAY} से। किसी तेज़ लाइन के कम दिन इस तारीख को आगे नहीं खींचते। यह साइट सर्वे या फील्ड अपॉइंटमेंट नहीं है।`
    : `The slowest line on this quote is ${slowest.name}, ${slowest.installDays} typical catalogue days. The planning date is ${quote.activationDate}, counted from the case clock ${CASE_TODAY}. A faster line does not pull that date forward. This is not a site survey or a field appointment.`;
}

export function compose(input: AdviceInput): { advice: Advice; claim: ClaimContext } {
  const lang = replyLanguage(input.message, input.profile.uiLanguage === "hi" ? "hi" : "en");
  const intent = detectIntent(input.message);
  const score = scoreFor(input.profile);
  const budget = statedBudget(input.message);
  const bench = budget ?? input.profile.spend;
  const { focus, excluded } = selectFocus(input, intent, score);
  const claim: ClaimContext = {
    intent,
    products: input.products,
    quote: input.quote,
    spend: input.profile.spend,
    statedBudget: budget,
  };
  const who = input.profile.businessName || (lang === "hi" ? "यह व्यवसाय" : "this business");
  const blocks = focus.map((product) => productParagraph(product, quoteQty(input.quote, product.id), score, input.profile, bench, lang));
  let text = "";
  if (intent === "injection") text = injectionText(lang);
  else if (intent === "discovery") text = discoveryText(input.profile, lang);
  else if (intent === "paper") text = [paperText(lang), uncertainty(lang)].join("\n\n");
  else if (intent === "internet") {
    const lead = lang === "hi"
      ? `${who} के लिए सिर्फ इंटरनेट रखना ठीक है। नीचे केवल वे ब्रॉडबैंड लाइनें हैं जो कैटलॉग में अकेले बिक सकती हैं और इस प्रोफ़ाइल पर पात्र हैं।`
      : `Keeping only internet is a fair change for ${who}. The lines below are broadband products that can stand alone and are eligible on this profile.`;
    const none = lang === "hi"
      ? "इस प्रोफ़ाइल पर कोई अकेली ब्रॉडबैंड लाइन पात्र नहीं है। मैं कोई लाइन गढ़ूँगा नहीं।"
      : "No standalone broadband product is eligible for this profile. I will not invent one.";
    text = [lead, blocks.length ? blocks.join("\n\n") : none, excluded.length ? exclusionParagraph(excluded, lang) : "", formsNote(lang), uncertainty(lang)].filter(Boolean).join("\n\n");
  } else if (intent === "price") {
    const lead = input.quote?.lines.length
      ? spendCompare(input.quote, bench, budget, lang)
      : lang === "hi"
        ? `कोट सेव नहीं है, इसलिए पूरे बंडल के बारे में तुलना नहीं करूँगा। नीचे दी गई लाइन का फ़्लोर दर्ज आंकड़े ${inr(bench)} से अलग-अलग देखा गया है।`
        : `No quote is saved, so I will not judge a whole bundle. Each floor below is compared on its own with the typed figure ${inr(bench)}.`;
    text = [lead, ...blocks, formsNote(lang), uncertainty(lang)].filter(Boolean).join("\n\n");
  } else if (intent === "install") {
    text = [installLead(input.quote, lang), ...blocks, uncertainty(lang)].filter(Boolean).join("\n\n");
  } else if (intent === "contract") {
    const longest = input.quote?.lines.length ? [...input.quote.lines].sort((a, b) => b.contractMonths - a.contractMonths || a.id.localeCompare(b.id))[0] : null;
    const lead = longest
      ? lang === "hi"
        ? `कोट अवधि ${input.quote?.contractMonths} महीने है क्योंकि ${longest.name} का न्यूनतम अनुबंध उतना है। छोटी लाइनें इस संख्या को घटाती नहीं। छोटी अवधि ज़्यादा ज़रूरी हो तो कोट फॉर्म पर उस लाइन को हटाएँ।`
        : `The quote term is ${input.quote?.contractMonths} months because ${longest.name} has that catalogue minimum. Shorter lines do not pull it down. Remove that line on the quote form if a shorter term matters more.`
      : lang === "hi"
        ? "अवधि चुनी हुई लाइनों में सबसे लंबे न्यूनतम अनुबंध के बराबर होगी।"
        : "The term will be the longest minimum contract among the lines you keep.";
    text = [lead, ...blocks, uncertainty(lang)].join("\n\n");
  } else if (intent === "incumbent") {
    const provider = input.profile.provider || (lang === "hi" ? "मौजूदा प्रदाता" : "the current provider");
    const lead = lang === "hi"
      ? `इस डेमो में ${provider} का कनेक्शन रद्द नहीं होता। तुलना कैटलॉग फ़ील्ड और आपके दर्ज खर्च से है। इंस्टॉल दिन के पीछे साइट सर्वे नहीं है।`
      : `Nothing in this demo cancels ${provider}. The comparison is catalogue fields against the spend you entered. There is no site survey behind the install days.`;
    text = [lead, ...blocks, uncertainty(lang)].join("\n\n");
  } else if (!focus.length) {
    text = lang === "hi"
      ? `मैं कैटलॉग के बाहर लाभ नहीं जोड़ता। ${formsNote(lang)} कीमत, सिर्फ इंटरनेट, मौजूदा प्रदाता, इंस्टॉल, अनुबंध, या कागज़ पूछें।`
      : `I will not add a benefit that is not in the catalogue. ${formsNote(lang)} Ask about price, internet only, your current provider, install time, contract length, or paperwork.`;
  } else {
    const lead = lang === "hi"
      ? `${who} के सवाल पर मैं इन्हीं कैटलॉग लाइनों तक रहूँगा। कोई लाइन हटानी हो, सिर्फ इंटरनेट चाहिए, या बजट बदलना हो, तो कहें।`
      : `On that question for ${who}, I will stay with these catalogue lines. Say if a line should be removed, if you only need internet, or if the budget changed.`;
    text = [lead, ...blocks, formsNote(lang), uncertainty(lang)].join("\n\n");
  }
  const advice: Advice = {
    mode: "grounded-composer",
    generative: false,
    disclosure: DISCLOSURE[lang],
    text,
    citations: focus.map((product) => ({ id: product.id, name: product.name })),
    latencyMs: null,
    model: null,
    runtime: null,
    fallbackReason: null,
    intent,
  };
  const problems = claimProblems(text, claim);
  if (problems.length) {
    advice.text = lang === "hi"
      ? `मैं इस जवाब को कैटलॉग से बाहर नहीं ले जाऊँगा। ${formsNote(lang)} ${uncertainty(lang)}`
      : `I will not go outside the catalogue on this reply. ${formsNote(lang)} ${uncertainty(lang)}`;
    advice.fallbackReason = `Composer claim check: ${problems[0]}`;
    advice.citations = [];
  }
  return { advice, claim };
}

export function advise(input: AdviceInput): Advice {
  return compose(input).advice;
}
