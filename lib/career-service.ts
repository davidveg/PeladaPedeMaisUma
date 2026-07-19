import { audit, db, ensureDb } from "./database";
import { careerConfigFromRow, matchWinner, rankCareerVotes, teamMomentumForResult, type CareerConfig } from "./career";
import { logEvent } from "./logger";
import { validateMatchContributions, type MatchContributionInput } from "./match-contributions";

export async function getCareerConfig() { await ensureDb(); return careerConfigFromRow(await db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first()); }

export function careerMatchFromRow(row: any) {
  if (!row) return null;
  return { id: row.id, separationId: row.separation_id, blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score), winnerTeam: row.winner_team, votingToken: row.voting_token, status: row.status, closesAt: row.closes_at, closedAt: row.closed_at, config: JSON.parse(row.config_snapshot), results: row.results_snapshot ? JSON.parse(row.results_snapshot) : null, createdAt: row.created_at };
}

export async function createCareerMatch(separationId: string, blueScore: number, yellowScore: number, administratorId: string, contributionInput: MatchContributionInput[] = []) {
  await ensureDb();
  const config = await getCareerConfig();
  if (!config.enabled) throw new Error("O Modo Carreira está desativado.");
  if (![blueScore,yellowScore].every(score=>Number.isInteger(score)&&score>=0&&score<=99)) throw new Error("Informe um placar válido entre 0 e 99 gols.");
  if (await db().prepare(`SELECT id FROM career_matches WHERE separation_id=?`).bind(separationId).first()) throw new Error("Esta partida já foi confirmada no Modo Carreira.");
  const separation: any = await db().prepare(`SELECT snapshot FROM team_separations WHERE id=? AND deleted_at IS NULL`).bind(separationId).first();
  if (!separation) throw new Error("Separação não encontrada.");
  const snapshot = JSON.parse(separation.snapshot), blueIds=(snapshot.blue||[]).map((player:any)=>player.id),yellowIds=(snapshot.yellow||[]).map((player:any)=>player.id);
  if (!blueIds.length || !yellowIds.length) throw new Error("A separação não possui dois times válidos.");
  if (new Set([...blueIds,...yellowIds]).size < 7) throw new Error("O Modo Carreira exige pelo menos 7 jogadores para que cada participante escolha seis destaques diferentes de si mesmo.");
  const contributionValidation=config.trackContributions?validateMatchContributions({contributions:contributionInput,blueScore,yellowScore,blueIds,yellowIds}):{error:null,contributions:[] as MatchContributionInput[]};
  if(contributionValidation.error)throw new Error(contributionValidation.error);
  const winnerTeam=matchWinner(blueScore,yellowScore),id=crypto.randomUUID(),token=[...crypto.getRandomValues(new Uint8Array(24))].map(value=>value.toString(16).padStart(2,"0")).join(""),now=new Date(),closesAt=new Date(now.getTime()+config.votingDays*86400000);
  const statements=[db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,closed_at,created_by_administrator_id,config_snapshot,results_snapshot,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,'OPEN',?,NULL,?,?,NULL,1,0,?,?)`).bind(id,separationId,blueScore,yellowScore,winnerTeam,token,closesAt.toISOString(),administratorId,JSON.stringify(config),now.toISOString(),now.toISOString())];
  const deltaFor=(team:"BLUE"|"YELLOW")=>winnerTeam==="DRAW"?0:winnerTeam===team?config.winnerBonus:config.loserPenalty;
  for(const playerId of blueIds) statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),updated_at=? WHERE id=?`).bind(deltaFor("BLUE"),now.toISOString(),playerId));
  for(const playerId of yellowIds) statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),updated_at=? WHERE id=?`).bind(deltaFor("YELLOW"),now.toISOString(),playerId));
  for(const contribution of contributionValidation.contributions) statements.push(db().prepare(`INSERT INTO career_match_contributions (id,career_match_id,scorer_player_id,assist_player_id,team,is_own_goal,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,contribution.scorerPlayerId,contribution.assistPlayerId||null,contribution.team,contribution.ownGoal?1:0,now.toISOString()));
  await db().batch(statements);
  await audit(administratorId,"CAREER_MATCH_CONFIRMED","career_match",id,{separationId,blueScore,yellowScore,winnerTeam,closesAt:closesAt.toISOString(),goals:contributionValidation.contributions.filter(goal=>!goal.ownGoal).length,ownGoals:contributionValidation.contributions.filter(goal=>goal.ownGoal).length,assists:contributionValidation.contributions.filter(goal=>goal.assistPlayerId).length});
  logEvent("info","career_match_confirmed",{careerMatchId:id,separationId,winnerTeam});
  return careerMatchFromRow(await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(id).first());
}

export async function editCareerMatch(matchId:string,blueScore:number,yellowScore:number,administratorId:string,contributionInput:MatchContributionInput[]=[]){
  await ensureDb();
  if(![blueScore,yellowScore].every(score=>Number.isInteger(score)&&score>=0&&score<=99))throw new Error("Informe um placar válido entre 0 e 99 gols.");
  const row:any=await db().prepare(`SELECT c.*,s.snapshot FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE c.id=? AND s.deleted_at IS NULL`).bind(matchId).first();
  if(!row)throw new Error("Partida do Modo Carreira não encontrada.");
  const snapshot=JSON.parse(row.snapshot),blueIds=(snapshot.blue||[]).map((player:any)=>player.id),yellowIds=(snapshot.yellow||[]).map((player:any)=>player.id),currentConfig=await getCareerConfig();
  const validation=currentConfig.trackContributions?validateMatchContributions({contributions:contributionInput,blueScore,yellowScore,blueIds,yellowIds}):{error:null,contributions:[] as MatchContributionInput[]};
  if(validation.error)throw new Error(validation.error);
  const previousContributions=(await db().prepare(`SELECT scorer_player_id,assist_player_id,team,is_own_goal FROM career_match_contributions WHERE career_match_id=? ORDER BY created_at`).bind(matchId).all()).results as any[];
  const oldWinner=row.winner_team as "BLUE"|"YELLOW"|"DRAW",newWinner=matchWinner(blueScore,yellowScore),rules={winnerBonus:.1,loserPenalty:-.1,...JSON.parse(row.config_snapshot||"{}")},now=new Date().toISOString(),statements:any[]=[];
  for(const [team,ids] of [["BLUE",blueIds],["YELLOW",yellowIds]] as const){const adjustment=teamMomentumForResult(newWinner,team,rules.winnerBonus,rules.loserPenalty)-teamMomentumForResult(oldWinner,team,rules.winnerBonus,rules.loserPenalty);if(adjustment)for(const playerId of ids)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),updated_at=? WHERE id=?`).bind(adjustment,now,playerId))}
  statements.push(db().prepare(`UPDATE career_matches SET blue_score=?,yellow_score=?,winner_team=?,updated_at=? WHERE id=?`).bind(blueScore,yellowScore,newWinner,now,matchId));
  if(currentConfig.trackContributions||blueScore!==Number(row.blue_score)||yellowScore!==Number(row.yellow_score))statements.push(db().prepare(`DELETE FROM career_match_contributions WHERE career_match_id=?`).bind(matchId));
  if(currentConfig.trackContributions)for(const goal of validation.contributions)statements.push(db().prepare(`INSERT INTO career_match_contributions (id,career_match_id,scorer_player_id,assist_player_id,team,is_own_goal,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),matchId,goal.scorerPlayerId,goal.assistPlayerId||null,goal.team,goal.ownGoal?1:0,now));
  await db().batch(statements);
  await audit(administratorId,"CAREER_MATCH_EDITED","career_match",matchId,{blueScore,yellowScore,winnerTeam:newWinner,contributions:currentConfig.trackContributions?validation.contributions:undefined},{blueScore:Number(row.blue_score),yellowScore:Number(row.yellow_score),winnerTeam:oldWinner,contributions:previousContributions});
  logEvent("info","career_match_edited",{careerMatchId:matchId,oldWinner,newWinner,blueScore,yellowScore});
  return careerMatchFromRow(await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first());
}

export async function finalizeCareerMatch(matchId: string, administratorId: string | null = null) {
  await ensureDb();
  let row:any=await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first();
  if (!row) throw new Error("Partida do Modo Carreira não encontrada.");
  if (row.status==="CLOSED") return careerMatchFromRow(row);
  if (row.status!=="OPEN") throw new Error("A votação já está sendo encerrada.");
  const claimed=await db().prepare(`UPDATE career_matches SET status='FINALIZING',updated_at=? WHERE id=? AND status='OPEN'`).bind(new Date().toISOString(),matchId).run();
  if(Number(claimed.meta?.changes??0)!==1) throw new Error("A votação já está sendo encerrada.");
  try {
    const votes=(await db().prepare(`SELECT * FROM career_votes WHERE career_match_id=?`).bind(matchId).all()).results;
    const motm=rankCareerVotes(votes,"motm"),dotm=rankCareerVotes(votes,"dotm"),config=JSON.parse(row.config_snapshot) as CareerConfig;
    const motmPoints=[config.motmFirst,config.motmSecond,config.motmThird],dotmPoints=[config.dotmFirst,config.dotmSecond,config.dotmThird],now=new Date().toISOString();
    const statements:any[]=[];
    motm.forEach((entry,index)=>statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),updated_at=? WHERE id=?`).bind(motmPoints[index],now,entry.playerId)));
    dotm.forEach((entry,index)=>statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),updated_at=? WHERE id=?`).bind(dotmPoints[index],now,entry.playerId)));
    const results={voteCount:votes.length,motm:motm.map((entry,index)=>({...entry,momentum:motmPoints[index]})),dotm:dotm.map((entry,index)=>({...entry,momentum:dotmPoints[index]}))};
    statements.push(db().prepare(`UPDATE career_matches SET status='CLOSED',closed_at=?,results_snapshot=?,votes_momentum_applied=1,updated_at=? WHERE id=? AND status='FINALIZING'`).bind(now,JSON.stringify(results),now,matchId));
    await db().batch(statements);
    await audit(administratorId,"CAREER_VOTING_CLOSED","career_match",matchId,{voteCount:votes.length,automatic:!administratorId,results});
    logEvent("info","career_voting_closed",{careerMatchId:matchId,voteCount:votes.length,automatic:!administratorId});
  } catch(error) {
    await db().prepare(`UPDATE career_matches SET status='OPEN',updated_at=? WHERE id=? AND status='FINALIZING'`).bind(new Date().toISOString(),matchId).run();
    throw error;
  }
  row=await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first();
  return careerMatchFromRow(row);
}

export async function finalizeIfExpired(row:any) { if(row?.status==="OPEN"&&new Date(row.closes_at).getTime()<=Date.now()) return finalizeCareerMatch(row.id,null); return careerMatchFromRow(row); }
