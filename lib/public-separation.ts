type PublicPlayerCareerStats = { games: number; wins: number; losses: number; goals?: number; assists?: number };

export function publicSeparation(row: any, careerStats: Record<string, PublicPlayerCareerStats> = {}, contributions: any[] = []) {
  const snapshot = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
  const withStats = (player: any) => ({ ...player, careerStats: careerStats[player.id] ?? { games: 0, wins: 0, losses: 0 } });
  snapshot.blue = (snapshot.blue || []).map(withStats);
  snapshot.yellow = (snapshot.yellow || []).map(withStats);
  const separation:any = {
    id: row.id,
    matchTitle: row.match_title,
    matchDate: row.match_date,
    location: row.location,
    snapshot,
    balanceClassification: row.balance_classification,
    balanceScore: row.balance_score,
    confirmedAt: row.confirmed_at,
    manuallyAdjusted: Boolean(row.manually_adjusted),
    arrivalOrder: parseTeamArrivalOrder(row.arrival_order,(snapshot.blue||[]).map((player:any)=>String(player.id)),(snapshot.yellow||[]).map((player:any)=>String(player.id))),
  };
  if(row.career_id) {
    const names=Object.fromEntries([...(snapshot.blue||[]),...(snapshot.yellow||[])].map((player:any)=>[player.id,player.displayName]));
    separation.career={id:row.career_id,blueScore:Number(row.career_blue_score),yellowScore:Number(row.career_yellow_score),winnerTeam:row.career_winner_team,votingToken:row.career_voting_token,status:row.career_status,closesAt:row.career_closes_at,closedAt:row.career_closed_at,config:row.career_config_snapshot?JSON.parse(row.career_config_snapshot):null,results:row.career_results_snapshot?JSON.parse(row.career_results_snapshot):null,contributions:contributions.map(goal=>({team:goal.team,scorerPlayerId:goal.scorer_player_id,scorerName:names[goal.scorer_player_id]||"Jogador",assistPlayerId:goal.assist_player_id||null,assistName:goal.assist_player_id?names[goal.assist_player_id]||"Jogador":null,ownGoal:Boolean(goal.is_own_goal)}))};
  }
  return separation;
}

function parseTeamArrivalOrder(value:unknown,blueIds:string[],yellowIds:string[]){
  if(!value)return null;
  try{const parsed:any=typeof value==="string"?JSON.parse(value):value,toValidTeam=(order:unknown,ids:string[])=>Array.isArray(order)&&order.length===ids.length&&new Set(order.map(String)).size===order.length&&order.every(id=>ids.includes(String(id)))?order.map(String):null;if(Array.isArray(parsed)){const legacy=parsed.map(String),blue=legacy.filter(id=>blueIds.includes(id)),yellow=legacy.filter(id=>yellowIds.includes(id));return blue.length===blueIds.length&&yellow.length===yellowIds.length?{blue,yellow}:null}const blue=toValidTeam(parsed?.blue,blueIds),yellow=toValidTeam(parsed?.yellow,yellowIds);return blue&&yellow?{blue,yellow}:null}catch{return null}
}
