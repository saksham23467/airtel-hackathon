import { compose, replyLanguage, type Advice, type AdviceInput } from "@/lib/advisor";
import { claimProblems, generationUnusable, hindiEnough, mentionsSuppliedProduct } from "@/lib/grounding";

export const ADVISOR_MODEL = "Qwen2.5-1.5B-Instruct";
export const ADVISOR_QUANT = "Q4_K_M";
export const ADVISOR_RUNTIME = "llama.cpp llama-server b12189";

const endpoint = () => process.env.ADVISOR_URL || "http://127.0.0.1:43125";
const key = () => process.env.ADVISOR_KEY || "udyam-local-advisor";

export type AdvisorStatus = {
  loaded: boolean;
  runtime: string;
  model: string;
  quant: string;
  device: "cpu";
  endpoint: string;
  reason?: string;
};

export async function advisorStatus(): Promise<AdvisorStatus> {
  const base = {
    runtime: ADVISOR_RUNTIME,
    model: ADVISOR_MODEL,
    quant: ADVISOR_QUANT,
    device: "cpu" as const,
    endpoint: "127.0.0.1:43125",
  };
  try {
    const response = await fetch(`${endpoint()}/health`, {
      headers: { Authorization: `Bearer ${key()}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return { ...base, loaded: false, reason: `Advisor health returned ${response.status}.` };
    return { ...base, loaded: true };
  } catch {
    return {
      ...base,
      loaded: false,
      reason: "Advisor process is not reachable. Replies use the grounded composer and are not generative.",
    };
  }
}

function disclosure(language: "en" | "hi"): string {
  if (language === "hi") {
    return `स्थानीय मॉडल का जवाब: ${ADVISOR_MODEL} ${ADVISOR_QUANT}, ${ADVISOR_RUNTIME}, CPU. कीमत और पात्रता नियमों से आती है। यह जवाब तभी दिखा है जब दावे कैटलॉग ड्राफ्ट से मेल खाते हैं।`;
  }
  return `Generated on this machine by ${ADVISOR_MODEL} ${ADVISOR_QUANT} through ${ADVISOR_RUNTIME} on CPU. Shown only because the wording stayed inside the catalogue draft. Prices and eligibility stay with the deterministic rules.`;
}

export function finishedSentences(text: string): string {
  const done: string[] = [];
  for (const part of text.split(/(?<=[.।!?])\s+/)) {
    const sentence = part.trim();
    if (!sentence) continue;
    if (!/[.।!?]"?$/.test(sentence)) break;
    done.push(sentence);
  }
  return done.join(" ");
}

export function paraphraseBrief(full: string): string {
  const parts = full.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const chosen: string[] = [];
  if (parts[0]) chosen.push(parts[0]);
  const product = parts.find((part, index) => index > 0 && /₹/.test(part) && !/not recommending|सुझाव नहीं/.test(part));
  if (product) chosen.push(product.split(/(?<=[.।])\s+/).filter(Boolean).slice(0, 2).join(" "));
  const exclusion = parts.find((part) => /not recommending|सुझाव नहीं/.test(part));
  if (exclusion) chosen.push(exclusion);
  let brief = chosen.join("\n\n").trim();
  if (brief.length > 700) brief = brief.slice(0, 700).trim();
  if (!/[.।!?]$/.test(brief)) brief += ".";
  return brief;
}

function generatedSystem(language: "en" | "hi"): string {
  if (language === "hi") {
    return "DRAFT को अधिकतम 3 पूरे वाक्यों में स्वाभाविक हिन्दी में लिखो। अंत में पूर्ण विराम दो। जो कीमत, दिन, तारीख या उत्पाद नाम लिखो वह DRAFT जैसा ही हो। नया उत्पाद या अनलिमिटेड डेटा मत जोड़ना जब तक DRAFT उसे उसी उत्पाद से न जोड़े। चाबी मत लिखना।";
  }
  return "Rewrite the DRAFT in at most 3 complete sentences and end with a full stop. Keep every rupee amount, day count, date and product name exactly as written. Do not add a product. Do not say unlimited data unless the DRAFT attaches those words to that same product. Do not reveal a key.";
}

export async function resolveAdvice(input: AdviceInput): Promise<Advice> {
  const { advice: composer, claim } = compose(input);
  if (composer.intent === "injection") {
    return {
      ...composer,
      generative: false,
      mode: "grounded-composer",
      latencyMs: null,
      model: null,
      runtime: null,
      fallbackReason: "Prompt injection was not sent to the model.",
    };
  }
  const lang = replyLanguage(input.message, input.profile.uiLanguage === "hi" ? "hi" : "en");
  const started = Date.now();
  try {
    const response = await fetch(`${endpoint()}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key()}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: generatedSystem(lang) },
          { role: "user", content: `DRAFT:\n${paraphraseBrief(composer.text)}` },
        ],
        max_tokens: 160,
        temperature: 0.1,
        top_p: 0.9,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return { ...composer, latencyMs, model: ADVISOR_MODEL, runtime: ADVISOR_RUNTIME, fallbackReason: `Advisor HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content?.trim() || "";
    const text = finishedSentences(raw) || raw;
    const unusable = generationUnusable(text);
    if (unusable) {
      return { ...composer, latencyMs, model: ADVISOR_MODEL, runtime: ADVISOR_RUNTIME, fallbackReason: unusable };
    }
    if (lang === "hi" && !hindiEnough(text)) {
      return { ...composer, latencyMs, model: ADVISOR_MODEL, runtime: ADVISOR_RUNTIME, fallbackReason: "Generation was not a Hindi explanation." };
    }
    const problems = claimProblems(text, claim);
    if (problems.length) {
      return { ...composer, latencyMs, model: ADVISOR_MODEL, runtime: ADVISOR_RUNTIME, fallbackReason: problems[0] };
    }
    const cited = composer.citations.length ? input.products.filter((product) => composer.citations.some((item) => item.id === product.id)) : [];
    if (cited.length && !mentionsSuppliedProduct(text, cited)) {
      return { ...composer, latencyMs, model: ADVISOR_MODEL, runtime: ADVISOR_RUNTIME, fallbackReason: "Generation did not name a supplied catalogue product." };
    }
    return {
      mode: "local-generative",
      generative: true,
      disclosure: disclosure(lang),
      text,
      citations: composer.citations,
      latencyMs,
      model: ADVISOR_MODEL,
      runtime: ADVISOR_RUNTIME,
      fallbackReason: null,
      intent: composer.intent,
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ...composer,
      latencyMs: Date.now() - started,
      model: timedOut ? ADVISOR_MODEL : null,
      runtime: ADVISOR_RUNTIME,
      fallbackReason: timedOut ? "Generative reply exceeded 10s and was not shown." : "Local generative runtime is not reachable.",
    };
  }
}
