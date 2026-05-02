export function computeInequality(data: number[], metric: string = "gini"): number {
 if (!data || data.length === 0) return 0;

 if (metric === "gini") {
  // Sort data ascending
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  
  let sumDiffs = 0;
  let sumValues = 0;

  for (let i = 0; i < n; i++) {
   sumValues += sorted[i];
   for (let j = 0; j < n; j++) {
    sumDiffs += Math.abs(sorted[i] - sorted[j]);
   }
  }

  if (sumValues === 0) return 0;
  return sumDiffs / (2 * n * sumValues);
 }

 // Atkinson, Theil fallbacks
 if (metric === "atkinson") {
  const n = data.length;
  const mean = data.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  const epsilon = 0.5;
  let sumPow = 0;
  for (const v of data) {
   sumPow += Math.pow(v / mean, 1 - epsilon);
  }

  return 1 - Math.pow(sumPow / n, 1 / (1 - epsilon));
 }

 return 0;
}
