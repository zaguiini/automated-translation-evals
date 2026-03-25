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
