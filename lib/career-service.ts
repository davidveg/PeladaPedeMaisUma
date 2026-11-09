import { audit, db, ensureDb } from "./database";
import { careerConfigFromRow, defaultCareerConfig, matchWinner, rankCareerRecognition, rankCareerVotes, teamMomentumForResult, type CareerConfig } from "./career";
import { logEvent } from "./logger";
import { validateMatchContributions, type MatchContributionInput } from "./match-contributions";
import { notifyOpenCareerVote } from "./push-notifications";
import { ensureCareerSeasonCurrent } from "./career-season";
import { tryFinalizeMonthlyAwardAfterMatch } from "./career-awards";
import { buildParticipationSnapshot, effectiveParticipation, participationSummary, type MatchParticipationInput } from "./match-participation";

export async function getCareerConfig() { await ensureDb(); await ensureCareerSeasonCurrent(); return careerConfigFromRow(await db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first()); }

export function careerMatchFromRow(row: any) {
  if (!row) return null;
  return { id: row.id, separationId: row.separation_id, blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score), winnerTeam: row.winner_team, votingToken: row.voting_token, status: row.status, closesAt: row.closes_at, closedAt: row.closed_at, config: JSON.parse(row.config_snapshot), results: row.results_snapshot ? JSON.parse(row.results_snapshot) : null, participation: row.participation_snapshot ? JSON.parse(row.participation_snapshot) : null, attendanceBonus: row.attendance_bonus_applied_at ? { value: Number(row.attendance_bonus_value), reason: row.attendance_bonus_reason, appliedAt: row.attendance_bonus_applied_at } : null, createdAt: row.created_at };
}

export async function createCareerMatch(separationId: string, blueScore: number, yellowScore: number, administratorId: string, contributionInput: MatchContributionInput[] = [], participationInput?: MatchParticipationInput, attendanceBonusInput?: { apply?: boolean; reason?: string }) {
  await ensureDb();
  const config = await getCareerConfig();
  if (!config.enabled) throw new Error("O Modo Carreira está desativado.");
  if (![blueScore,yellowScore].every(score=>Number.isInteger(score)&&score>=0&&score<=99)) throw new Error("Informe um placar válido entre 0 e 99 gols.");
  if (await db().prepare(`SELECT id FROM career_matches WHERE separation_id=?`).bind(separationId).first()) throw new Error("Esta partida já foi confirmada no Modo Carreira.");
  const separation: any = await db().prepare(
    `SELECT s.snapshot,m.status scheduled_match_status
     FROM team_separations s LEFT JOIN scheduled_matches m ON m.separation_id=s.id
     WHERE s.id=? AND s.deleted_at IS NULL`,
  ).bind(separationId).first();
  if (!separation) throw new Error("Escalação não encontrada.");
  if (separation.scheduled_match_status === "CANCELLED") throw new Error("Não é possível confirmar resultado de uma partida cancelada.");
  const snapshot = JSON.parse(separation.snapshot);
  if (!(snapshot.blue||[]).length || !(snapshot.yellow||[]).length) throw new Error("A escalação não possui dois times válidos.");
  const playerRows=(await db().prepare(`SELECT id,display_name,full_name,photo_url,primary_position,secondary_position,type FROM players`).all()).results as any[];
  const participation=buildParticipationSnapshot({input:participationInput as MatchParticipationInput,lineup:snapshot,players:playerRows,administratorId,now:new Date().toISOString()});
  const blueIds=participation.blue.map(player=>player.id),yellowIds=participation.yellow.map(player=>player.id);
  const contributionValidation=config.trackContributions?validateMatchContributions({contributions:contributionInput,blueScore,yellowScore,blueIds,yellowIds}):{error:null,contributions:[] as MatchContributionInput[]};
  if(contributionValidation.error)throw new Error(contributionValidation.error);
  const applyAttendanceBonus=attendanceBonusInput?.apply===true;
  if(applyAttendanceBonus&&!config.attendanceBonusEnabled)throw new Error("O bônus especial de presença está desativado nesta instância.");
  const attendanceBonusReason=String(attendanceBonusInput?.reason||"").trim();
  if(applyAttendanceBonus&&(attendanceBonusReason.length<3||attendanceBonusReason.length>160))throw new Error("Informe um motivo entre 3 e 160 caracteres para o bônus especial.");
  const attendanceBonusValue=applyAttendanceBonus?Number(config.attendanceBonusDefaultValue):null;
  const winnerTeam=matchWinner(blueScore,yellowScore),id=crypto.randomUUID(),token=[...crypto.getRandomValues(new Uint8Array(24))].map(value=>value.toString(16).padStart(2,"0")).join(""),now=new Date(),closesAt=new Date(now.getTime()+config.votingDays*86400000);
  const statements=[db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,closed_at,created_by_administrator_id,config_snapshot,results_snapshot,participation_snapshot,attendance_bonus_value,attendance_bonus_reason,attendance_bonus_applied_at,attendance_bonus_applied_by_administrator_id,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,'OPEN',?,NULL,?,?,NULL,?,?,?,?,?,1,0,?,?)`).bind(id,separationId,blueScore,yellowScore,winnerTeam,token,closesAt.toISOString(),administratorId,JSON.stringify(config),JSON.stringify(participation),attendanceBonusValue,applyAttendanceBonus?attendanceBonusReason:null,applyAttendanceBonus?now.toISOString():null,applyAttendanceBonus?administratorId:null,now.toISOString(),now.toISOString())];
  const deltaFor=(team:"BLUE"|"YELLOW")=>winnerTeam==="DRAW"?0:winnerTeam===team?config.winnerBonus:config.loserPenalty;
  for(const playerId of blueIds) statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),result_momentum=ROUND(result_momentum+?,3),updated_at=? WHERE id=?`).bind(deltaFor("BLUE"),deltaFor("BLUE"),now.toISOString(),playerId));
  for(const playerId of yellowIds) statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),result_momentum=ROUND(result_momentum+?,3),updated_at=? WHERE id=?`).bind(deltaFor("YELLOW"),deltaFor("YELLOW"),now.toISOString(),playerId));
  if(attendanceBonusValue)for(const playerId of [...blueIds,...yellowIds])statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),voting_momentum=ROUND(voting_momentum+?,3),updated_at=? WHERE id=?`).bind(attendanceBonusValue,attendanceBonusValue,now.toISOString(),playerId));
  for(const contribution of contributionValidation.contributions) statements.push(db().prepare(`INSERT INTO career_match_contributions (id,career_match_id,scorer_player_id,assist_player_id,team,is_own_goal,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,contribution.scorerPlayerId,contribution.assistPlayerId||null,contribution.team,contribution.ownGoal?1:0,now.toISOString()));
  statements.push(db().prepare(`UPDATE team_separations SET match_draft=NULL,updated_at=? WHERE id=?`).bind(now.toISOString(),separationId));
  await db().batch(statements);
  await audit(administratorId,"CAREER_MATCH_CONFIRMED","career_match",id,{separationId,blueScore,yellowScore,winnerTeam,closesAt:closesAt.toISOString(),participation:participationSummary(participation),attendanceBonus:attendanceBonusValue?{value:attendanceBonusValue,reason:attendanceBonusReason,participants:blueIds.length+yellowIds.length}:null,goals:contributionValidation.contributions.filter(goal=>!goal.ownGoal).length,ownGoals:contributionValidation.contributions.filter(goal=>goal.ownGoal).length,assists:contributionValidation.contributions.filter(goal=>goal.assistPlayerId).length});
  logEvent("info","career_match_confirmed",{careerMatchId:id,separationId,winnerTeam});
  await notifyOpenCareerVote(id);
  return careerMatchFromRow(await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(id).first());
}

export async function editCareerMatch(matchId:string,blueScore:number,yellowScore:number,administratorId:string,contributionInput:MatchContributionInput[]=[],participationInput?:MatchParticipationInput){
  await ensureDb();
  if(![blueScore,yellowScore].every(score=>Number.isInteger(score)&&score>=0&&score<=99))throw new Error("Informe um placar válido entre 0 e 99 gols.");
  const row:any=await db().prepare(`SELECT c.*,s.snapshot,s.match_date FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE c.id=? AND s.deleted_at IS NULL`).bind(matchId).first();
  if(!row)throw new Error("Partida do Modo Carreira não encontrada.");
  const snapshot=JSON.parse(row.snapshot),currentConfig=await getCareerConfig(),playerRows=(await db().prepare(`SELECT id,display_name,full_name,photo_url,primary_position,secondary_position,type FROM players`).all()).results as any[];
  const participation=buildParticipationSnapshot({input:participationInput as MatchParticipationInput,lineup:snapshot,players:playerRows,administratorId,now:new Date().toISOString()}),blueIds=participation.blue.map(player=>player.id),yellowIds=participation.yellow.map(player=>player.id);
  const previousParticipation=effectiveParticipation(row),previousBlueIds=previousParticipation.blue.map((player:any)=>String(player.id)),previousYellowIds=previousParticipation.yellow.map((player:any)=>String(player.id));
  const participationChanged=teamKey(previousBlueIds,previousYellowIds)!==teamKey(blueIds,yellowIds);
  if(participationChanged&&row.match_date&&await db().prepare(`SELECT 1 found FROM monthly_career_awards WHERE month=?`).bind(String(row.match_date).slice(0,7)).first("found"))throw new Error("A participação não pode ser alterada porque o resultado mensal desta partida já foi consolidado.");
  const validation=currentConfig.trackContributions?validateMatchContributions({contributions:contributionInput,blueScore,yellowScore,blueIds,yellowIds}):{error:null,contributions:[] as MatchContributionInput[]};
  if(validation.error)throw new Error(validation.error);
  const previousContributions=(await db().prepare(`SELECT scorer_player_id,assist_player_id,team,is_own_goal FROM career_match_contributions WHERE career_match_id=? ORDER BY created_at`).bind(matchId).all()).results as any[];
  const previousVotes=(await db().prepare(`SELECT * FROM career_votes WHERE career_match_id=? ORDER BY created_at`).bind(matchId).all()).results as any[];
  const oldWinner=row.winner_team as "BLUE"|"YELLOW"|"DRAW",newWinner=matchWinner(blueScore,yellowScore),rules={winnerBonus:.1,loserPenalty:-.1,...JSON.parse(row.config_snapshot||"{}")},now=new Date().toISOString(),statements:any[]=[];
  const belongsToCurrentSeason=Number(rules.seasonNumber??1)===Number(currentConfig.seasonNumber??1);
  if(belongsToCurrentSeason){const before=resultMomentumByPlayer(previousBlueIds,previousYellowIds,oldWinner,rules),after=resultMomentumByPlayer(blueIds,yellowIds,newWinner,rules);for(const playerId of new Set([...before.keys(),...after.keys()])){const adjustment=(after.get(playerId)||0)-(before.get(playerId)||0);if(adjustment)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),result_momentum=ROUND(result_momentum+?,3),updated_at=? WHERE id=?`).bind(adjustment,adjustment,now,playerId))}}
  const attendanceBonusValue=Number(row.attendance_bonus_value||0);
  if(belongsToCurrentSeason&&row.attendance_bonus_applied_at&&attendanceBonusValue){const before=new Set([...previousBlueIds,...previousYellowIds]),after=new Set([...blueIds,...yellowIds]);for(const playerId of new Set([...before,...after])){const adjustment=(after.has(playerId)?attendanceBonusValue:0)-(before.has(playerId)?attendanceBonusValue:0);if(adjustment)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),voting_momentum=ROUND(voting_momentum+?,3),updated_at=? WHERE id=?`).bind(adjustment,adjustment,now,playerId))}}
  const actualIds=new Set([...blueIds,...yellowIds]),validVotes=previousVotes.filter(vote=>voteIsValid(vote,actualIds)),invalidVoteIds=previousVotes.filter(vote=>!voteIsValid(vote,actualIds)).map(vote=>String(vote.id));
  for(const voteId of invalidVoteIds)statements.push(db().prepare(`DELETE FROM career_votes WHERE id=?`).bind(voteId));
  let resultsSnapshot=row.results_snapshot;
  if(row.status==="CLOSED"&&participationChanged){
    const previousResults=row.results_snapshot?JSON.parse(row.results_snapshot):null;
    if(belongsToCurrentSeason)for(const entry of resultEntries(previousResults)){const momentum=Number(entry.momentum||0);if(momentum)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum-?,3),voting_momentum=ROUND(voting_momentum-?,3),updated_at=? WHERE id=?`).bind(momentum,momentum,now,String(entry.playerId)))}
    const recalculated=votingResults(validVotes,rules);
    if(belongsToCurrentSeason)for(const entry of resultEntries(recalculated))if(entry.momentum)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),voting_momentum=ROUND(voting_momentum+?,3),updated_at=? WHERE id=?`).bind(entry.momentum,entry.momentum,now,entry.playerId));
    resultsSnapshot=JSON.stringify(recalculated);
  }
  statements.push(db().prepare(`UPDATE career_matches SET blue_score=?,yellow_score=?,winner_team=?,participation_snapshot=?,results_snapshot=?,updated_at=? WHERE id=?`).bind(blueScore,yellowScore,newWinner,JSON.stringify(participation),resultsSnapshot,now,matchId));
  if(currentConfig.trackContributions||blueScore!==Number(row.blue_score)||yellowScore!==Number(row.yellow_score))statements.push(db().prepare(`DELETE FROM career_match_contributions WHERE career_match_id=?`).bind(matchId));
  if(currentConfig.trackContributions)for(const goal of validation.contributions)statements.push(db().prepare(`INSERT INTO career_match_contributions (id,career_match_id,scorer_player_id,assist_player_id,team,is_own_goal,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),matchId,goal.scorerPlayerId,goal.assistPlayerId||null,goal.team,goal.ownGoal?1:0,now));
  await db().batch(statements);
  await audit(administratorId,"CAREER_MATCH_EDITED","career_match",matchId,{blueScore,yellowScore,winnerTeam:newWinner,participation:participationSummary(participation),invalidVotesRemoved:invalidVoteIds.length,contributions:currentConfig.trackContributions?validation.contributions:undefined},{blueScore:Number(row.blue_score),yellowScore:Number(row.yellow_score),winnerTeam:oldWinner,participation:{blueIds:previousBlueIds,yellowIds:previousYellowIds},contributions:previousContributions});
  logEvent("info","career_match_edited",{careerMatchId:matchId,oldWinner,newWinner,blueScore,yellowScore});
  return careerMatchFromRow(await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first());
}

function teamKey(blueIds:string[],yellowIds:string[]){return `${[...blueIds].sort().join(",")}|${[...yellowIds].sort().join(",")}`}
function resultMomentumByPlayer(blueIds:string[],yellowIds:string[],winner:"BLUE"|"YELLOW"|"DRAW",rules:any){const values=new Map<string,number>();for(const [team,ids] of [["BLUE",blueIds],["YELLOW",yellowIds]] as const){const value=teamMomentumForResult(winner,team,Number(rules.winnerBonus),Number(rules.loserPenalty));for(const id of ids)values.set(id,value)}return values}
function voteIsValid(vote:any,participants:Set<string>){return [vote.voter_player_id,vote.motm_third_id,vote.motm_second_id,vote.motm_first_id,vote.dotm_third_id,vote.dotm_second_id,vote.dotm_first_id].every(id=>participants.has(String(id)))&&[vote.partner_id,vote.fair_play_id,vote.defense_id].every(id=>!id||participants.has(String(id)))}
function votingResults(votes:any[],config:any){
  const motm=rankCareerVotes(votes,"motm"),dotm=rankCareerVotes(votes,"dotm"),motmPoints=[config.motmFirst,config.motmSecond,config.motmThird],dotmPoints=[config.dotmFirst,config.dotmSecond,config.dotmThird];
  const recognition=(field:"partner_id"|"fair_play_id"|"defense_id",momentum:number)=>rankCareerRecognition(votes,field).map(entry=>({...entry,momentum:Number(momentum??.1)}));
  return{voteCount:votes.length,motm:motm.map((entry,index)=>({...entry,momentum:motmPoints[index]})),dotm:dotm.map((entry,index)=>({...entry,momentum:dotmPoints[index]})),partner:recognition("partner_id",config.partnerAward),fairPlay:recognition("fair_play_id",config.fairPlayAward),defense:recognition("defense_id",config.defenseAward)};
}
function resultEntries(results:any){return [...(results?.motm||[]),...(results?.dotm||[]),...(results?.partner||[]),...(results?.fairPlay||[]),...(results?.defense||[])]}

export async function applyAttendanceBonusToLatestMatch(matchId:string,reasonInput:string,administratorId:string){
  await ensureDb();
  const config=await getCareerConfig();
  if(!config.enabled||!config.attendanceBonusEnabled)throw new Error("O bônus especial de presença está desativado nesta instância.");
  const reason=String(reasonInput||"").trim();
  if(reason.length<3||reason.length>160)throw new Error("Informe um motivo entre 3 e 160 caracteres para o bônus especial.");
  const latest:any=await db().prepare(`SELECT c.*,s.match_date FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)) DESC,c.created_at DESC LIMIT 1`).first();
  if(!latest||String(latest.id)!==matchId)throw new Error("O bônus só pode ser aplicado à partida com resultado confirmado mais recente.");
  if(latest.attendance_bonus_applied_at)throw new Error("Esta partida já recebeu o bônus especial de presença.");
  const rules={...defaultCareerConfig,...JSON.parse(latest.config_snapshot||"{}")};
  if(Number(rules.seasonNumber??1)!==Number(config.seasonNumber??1))throw new Error("Não é possível alterar o Momentum de uma temporada já encerrada.");
  if(latest.match_date&&await db().prepare(`SELECT 1 found FROM monthly_career_awards WHERE month=?`).bind(String(latest.match_date).slice(0,7)).first("found"))throw new Error("O mês desta partida já foi consolidado.");
  const participation=effectiveParticipation(latest),playerIds=[...(participation.blue||[]),...(participation.yellow||[])].map((player:any)=>String(player.id)),value=Number(config.attendanceBonusDefaultValue),now=new Date().toISOString();
  if(!playerIds.length)throw new Error("A partida não possui participantes efetivos.");
  const claimed=await db().prepare(`UPDATE career_matches SET attendance_bonus_value=?,attendance_bonus_reason=?,attendance_bonus_applied_at=?,attendance_bonus_applied_by_administrator_id=?,updated_at=? WHERE id=? AND attendance_bonus_applied_at IS NULL`).bind(value,reason,now,administratorId,now,matchId).run();
  if(Number(claimed.meta?.changes??0)!==1)throw new Error("Esta partida já recebeu o bônus especial de presença.");
  await db().batch(playerIds.map(playerId=>db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),voting_momentum=ROUND(voting_momentum+?,3),updated_at=? WHERE id=?`).bind(value,value,now,playerId)));
  await audit(administratorId,"CAREER_ATTENDANCE_BONUS_APPLIED","career_match",matchId,{value,reason,participants:playerIds});
  logEvent("info","career_attendance_bonus_applied",{careerMatchId:matchId,value,participants:playerIds.length});
  return careerMatchFromRow(await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first());
}

export async function removeAttendanceBonusFromLatestMatch(matchId:string,administratorId:string){
  await ensureDb();
  const row:any=await db().prepare(`
    SELECT c.*,s.match_date,
      COALESCE(m.match_at,CASE WHEN s.match_date IS NOT NULL THEN s.match_date||'T23:59:59' END,c.created_at) effective_match_at
    FROM career_matches c
    JOIN team_separations s ON s.id=c.separation_id AND s.deleted_at IS NULL
    LEFT JOIN scheduled_matches m ON m.separation_id=s.id
    WHERE c.id=?
  `).bind(matchId).first();
  if(!row)throw new Error("Partida do Modo Carreira não encontrada.");
  if(!row.attendance_bonus_applied_at)throw new Error("Esta partida não possui bônus especial aplicado.");
  const latest:any=await db().prepare(`
    SELECT c.id
    FROM career_matches c
    JOIN team_separations s ON s.id=c.separation_id AND s.deleted_at IS NULL
    LEFT JOIN scheduled_matches m ON m.separation_id=s.id
    ORDER BY COALESCE(m.match_at,CASE WHEN s.match_date IS NOT NULL THEN s.match_date||'T23:59:59' END,c.created_at) DESC,c.created_at DESC
    LIMIT 1
  `).first();
  if(String(latest?.id||"")!==matchId)throw new Error("O bônus só pode ser removido da partida confirmada mais recente.");
  const newer=await db().prepare(`SELECT 1 found FROM scheduled_matches WHERE status<>'CANCELLED' AND match_at>? LIMIT 1`).bind(String(row.effective_match_at)).first("found");
  if(newer)throw new Error("Há uma partida mais nova criada. O bônus não pode mais ser removido.");
  const month=String(row.match_date||row.effective_match_at).slice(0,7);
  if(month&&await db().prepare(`SELECT 1 found FROM monthly_career_awards WHERE month=?`).bind(month).first("found"))throw new Error("O mês desta partida já foi consolidado.");
  const config=await getCareerConfig(),rules={...defaultCareerConfig,...JSON.parse(row.config_snapshot||"{}")};
  if(Number(rules.seasonNumber??1)!==Number(config.seasonNumber??1)||await db().prepare(`SELECT 1 found FROM career_season_awards WHERE season_number=?`).bind(Number(rules.seasonNumber??1)).first("found"))throw new Error("Não é possível alterar o Momentum de uma temporada já encerrada.");
  const participation=effectiveParticipation(row),playerIds=[...(participation.blue||[]),...(participation.yellow||[])].map((player:any)=>String(player.id)),value=Number(row.attendance_bonus_value||0),now=new Date().toISOString();
  const statements=playerIds.map(playerId=>db().prepare(`UPDATE players SET momentum=ROUND(momentum-?,3),voting_momentum=ROUND(voting_momentum-?,3),updated_at=? WHERE id=?`).bind(value,value,now,playerId));
  statements.push(db().prepare(`UPDATE career_matches SET attendance_bonus_value=NULL,attendance_bonus_reason=NULL,attendance_bonus_applied_at=NULL,attendance_bonus_applied_by_administrator_id=NULL,updated_at=? WHERE id=? AND attendance_bonus_applied_at IS NOT NULL`).bind(now,matchId));
  await db().batch(statements);
  await audit(administratorId,"CAREER_ATTENDANCE_BONUS_REMOVED","career_match",matchId,{removed:true,participants:playerIds},{value,reason:row.attendance_bonus_reason,appliedAt:row.attendance_bonus_applied_at});
  logEvent("info","career_attendance_bonus_removed",{careerMatchId:matchId,value,participants:playerIds.length});
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
    const config=JSON.parse(row.config_snapshot) as CareerConfig;
    const currentConfig=await getCareerConfig(),belongsToCurrentSeason=Number(config.seasonNumber??1)===Number(currentConfig.seasonNumber??1),now=new Date().toISOString();
    const results=votingResults(votes,config);
    const statements:any[]=[];
    if(belongsToCurrentSeason)for(const entry of resultEntries(results))if(entry.momentum)statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),voting_momentum=ROUND(voting_momentum+?,3),updated_at=? WHERE id=?`).bind(entry.momentum,entry.momentum,now,entry.playerId));
    statements.push(db().prepare(`UPDATE career_matches SET status='CLOSED',closed_at=?,results_snapshot=?,votes_momentum_applied=1,updated_at=? WHERE id=? AND status='FINALIZING'`).bind(now,JSON.stringify(results),now,matchId));
    await db().batch(statements);
    await audit(administratorId,"CAREER_VOTING_CLOSED","career_match",matchId,{voteCount:votes.length,automatic:!administratorId,momentumApplied:belongsToCurrentSeason,results});
    logEvent("info","career_voting_closed",{careerMatchId:matchId,voteCount:votes.length,automatic:!administratorId});
    try { await tryFinalizeMonthlyAwardAfterMatch(matchId); }
    catch (awardError: any) { logEvent("error","career_month_awards_auto_finalize_failed",{careerMatchId:matchId,error:String(awardError?.message||awardError)}); }
  } catch(error) {
    await db().prepare(`UPDATE career_matches SET status='OPEN',updated_at=? WHERE id=? AND status='FINALIZING'`).bind(new Date().toISOString(),matchId).run();
    throw error;
  }
  row=await db().prepare(`SELECT * FROM career_matches WHERE id=?`).bind(matchId).first();
  return careerMatchFromRow(row);
}

export async function finalizeIfExpired(row:any) { if(row?.status==="OPEN"&&new Date(row.closes_at).getTime()<=Date.now()) return finalizeCareerMatch(row.id,null); return careerMatchFromRow(row); }
