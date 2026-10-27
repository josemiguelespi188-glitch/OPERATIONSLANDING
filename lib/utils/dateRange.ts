/**
 * Shared "last 30 days vs all time" filter used by the admin dashboard's
 * stats endpoints (stats, investor-feedback, investor-update-requests).
 * A single 2-value range keeps the Overview page's range toggle simple --
 * add more buckets here (and to the toggle) if a finer range is ever
 * needed.
 */
export type StatsRange = "30d" | "all";

export function parseStatsRange(value: string | null): StatsRange {
  return value === "all" ? "all" : "30d";
}

/** ISO cutoff for the given range, or null for "all" (no filter). */
export function statsRangeCutoffISO(range: StatsRange): string | null {
  if (range === "all") return null;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  return cutoff.toISOString();
}
