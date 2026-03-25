import Anthropic from "@anthropic-ai/sdk";
import type { PoEntry } from "./parsePo.js";

const client = new Anthropic();
const JUDGE_MODEL = "claude-sonnet-4-6";

export interface JudgeResult {
  accuracy: number; // 0–10
  fluency: number;  // 0–10
  comment: string;
}

// ---------------------------------------------------------------------------
// BLEU
// ---------------------------------------------------------------------------

/**
 * Build a multiset (frequency map) of n-grams from a token array.
 */
function buildNgramCounts(tokens: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(" ");
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/**
 * Sentence-level BLEU with n-grams 1–4 and standard brevity penalty.
 * Returns a value in [0, 1].
 */
export function computeBleu(hypothesis: string, reference: string): number {
  const hypTokens = hypothesis.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const refTokens = reference.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const logPrecisions: number[] = [];

  for (let n = 1; n <= 4; n++) {
    // If hypothesis has fewer tokens than n, precision is 0 → BLEU = 0.
    if (hypTokens.length < n) {
      return 0;
    }

    const hypCounts = buildNgramCounts(hypTokens, n);
    const refCounts = buildNgramCounts(refTokens, n);

    let clippedMatches = 0;
    for (const [gram, hypCount] of hypCounts) {
      const refCount = refCounts.get(gram) ?? 0;
      clippedMatches += Math.min(hypCount, refCount);
    }

    const totalHypNgrams = hypTokens.length - n + 1;
    const precision = clippedMatches / totalHypNgrams;

    if (precision === 0) {
      return 0;
    }

    logPrecisions.push(Math.log(precision));
  }

  // Brevity penalty
  const bp =
    hypTokens.length >= refTokens.length
      ? 1
      : Math.exp(1 - refTokens.length / hypTokens.length);

  const avgLogPrecision = logPrecisions.reduce((a, b) => a + b, 0) / logPrecisions.length;
  return bp * Math.exp(avgLogPrecision);
}

// ---------------------------------------------------------------------------
// chrF
// ---------------------------------------------------------------------------

/**
 * Build a multiset of all character k-grams for a given string and order k.
 */
function buildCharNgramCounts(text: string, k: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i <= text.length - k; i++) {
    const gram = text.slice(i, i + k);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/**
 * Character-level F-score (chrF). Defaults to n=6 character n-gram order
 * and beta=2 (chrF2). Returns a value in [0, 1].
 */
export function computeChrF(
  hypothesis: string,
  reference: string,
  n = 6,
  beta = 2
): number {
  let totalChrP = 0;
  let totalChrR = 0;
  let orders = 0;

  for (let k = 1; k <= n; k++) {
    const hypCounts = buildCharNgramCounts(hypothesis, k);
    const refCounts = buildCharNgramCounts(reference, k);

    let overlaps = 0;
    for (const [gram, hypCount] of hypCounts) {
      const refCount = refCounts.get(gram) ?? 0;
      overlaps += Math.min(hypCount, refCount);
    }

    const totalHypKgrams = [...hypCounts.values()].reduce((a, b) => a + b, 0);
    const totalRefKgrams = [...refCounts.values()].reduce((a, b) => a + b, 0);

    const chrP_k = totalHypKgrams > 0 ? overlaps / totalHypKgrams : 0;
    const chrR_k = totalRefKgrams > 0 ? overlaps / totalRefKgrams : 0;

    totalChrP += chrP_k;
    totalChrR += chrR_k;
    orders++;
  }

  const chrP = totalChrP / orders;
  const chrR = totalChrR / orders;

  if (chrP === 0 && chrR === 0) {
    return 0;
  }

  const beta2 = beta * beta;
  return ((1 + beta2) * chrP * chrR) / (beta2 * chrP + chrR);
}

// ---------------------------------------------------------------------------
// LLM-as-judge
// ---------------------------------------------------------------------------

/**
 * Use claude-sonnet-4-6 to evaluate an AI translation against a human reference.
 * Returns accuracy (0–10), fluency (0–10), and a brief comment.
 */
export async function llmJudge(
  hypothesis: string,
  reference: string,
  entry: PoEntry
): Promise<JudgeResult> {
  const prompt = `You are evaluating a Brazilian Portuguese translation of an English UI string from the WooCommerce iOS app.

## Original English
${entry.msgid}

## Context (identifier)
${entry.msgctxt || "No context"}

## Developer comments
${entry.comments || "No comments"}

## Human reference translation
${reference}

## AI translation to evaluate
${hypothesis}

---

Score the AI translation on a scale of 0 to 10 across two dimensions:
- accuracy: How faithfully does it convey the meaning of the English source?
- fluency: How natural and idiomatic is the Brazilian Portuguese?

Respond with JSON only, no markdown fences: {"accuracy": <0-10>, "fluency": <0-10>, "comment": "<brief reason>"}`;

  const message = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("") ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    throw new Error(`LLM judge returned non-JSON response: ${rawText}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).accuracy !== "number" ||
    typeof (parsed as Record<string, unknown>).fluency !== "number" ||
    typeof (parsed as Record<string, unknown>).comment !== "string"
  ) {
    throw new Error(`LLM judge returned unexpected JSON shape: ${rawText}`);
  }

  const result = parsed as Record<string, unknown>;
  const acc = result.accuracy as number;
  const flu = result.fluency as number;
  if (acc < 0 || acc > 10 || flu < 0 || flu > 10) {
    throw new Error(`LLM judge returned out-of-range scores: accuracy=${acc}, fluency=${flu}`);
  }
  return { accuracy: acc, fluency: flu, comment: result.comment as string };
}
