export function publicSeparation(row: any) {
  const separation:any = {
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
  if(row.career_id) separation.career={id:row.career_id,blueScore:Number(row.career_blue_score),yellowScore:Number(row.career_yellow_score),winnerTeam:row.career_winner_team,votingToken:row.career_voting_token,status:row.career_status,closesAt:row.career_closes_at,closedAt:row.career_closed_at,config:row.career_config_snapshot?JSON.parse(row.career_config_snapshot):null,results:row.career_results_snapshot?JSON.parse(row.career_results_snapshot):null};
  return separation;
}
