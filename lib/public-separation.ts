export function publicSeparation(row: any) {
  return {
    id: row.id,
    matchTitle: row.match_title,
    matchDate: row.match_date,
    location: row.location,
    snapshot: typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot,
    balanceClassification: row.balance_classification,
    balanceScore: row.balance_score,
    confirmedAt: row.confirmed_at,
    manuallyAdjusted: Boolean(row.manually_adjusted),
  };
}
