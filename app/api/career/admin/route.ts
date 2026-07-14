import { careerConfigFromRow, validateCareerConfig, type CareerConfig } from "../../../../lib/career";
import { careerMatchFromRow, finalizeCareerMatch, finalizeIfExpired } from "../../../../lib/career-service";
import { adminRequired, audit, db, ensureDb } from "../../../../lib/database";

export async function GET(request:Request){
  if(!(await adminRequired(request)))return Response.json({error:"Não autorizado"},{status:401});await ensureDb();
  const open=(await db().prepare(`SELECT * FROM career_matches WHERE status='OPEN' AND closes_at<=?`).bind(new Date().toISOString()).all()).results;
  for(const match of open) await finalizeIfExpired(match);
  const config=careerConfigFromRow(await db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first());
  const rows=(await db().prepare(`SELECT c.*,s.match_title,s.match_date,s.snapshot FROM career_matches c JOIN team_separations s ON s.id=c.separation_id ORDER BY c.created_at DESC`).all()).results;
  const matches=[];
  for(const row of rows){const snapshot=JSON.parse((row as any).snapshot),players=[...(snapshot.blue||[]),...(snapshot.yellow||[])],names=Object.fromEntries(players.map((player:any)=>[player.id,player.displayName]));const votes=(await db().prepare(`SELECT * FROM career_votes WHERE career_match_id=? ORDER BY created_at`).bind((row as any).id).all()).results.map((vote:any)=>({id:vote.id,voterPlayerId:vote.voter_player_id,voterName:names[vote.voter_player_id]||"Jogador",motm:[vote.motm_first_id,vote.motm_second_id,vote.motm_third_id].map((id:string)=>({id,name:names[id]||"Jogador"})),dotm:[vote.dotm_first_id,vote.dotm_second_id,vote.dotm_third_id].map((id:string)=>({id,name:names[id]||"Jogador"})),createdAt:vote.created_at}));matches.push({...careerMatchFromRow(row),matchTitle:(row as any).match_title,matchDate:(row as any).match_date,votes});}
  return Response.json({config,matches});
}

export async function PUT(request:Request){
  const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});const payload=await request.json().catch(()=>({})) as any;
  const config:CareerConfig={enabled:Boolean(payload.enabled),winnerBonus:Number(payload.winnerBonus),loserPenalty:Number(payload.loserPenalty),motmThird:Number(payload.motmThird),motmSecond:Number(payload.motmSecond),motmFirst:Number(payload.motmFirst),dotmThird:Number(payload.dotmThird),dotmSecond:Number(payload.dotmSecond),dotmFirst:Number(payload.dotmFirst),votingDays:Number(payload.votingDays)};
  if(!validateCareerConfig(config))return Response.json({error:"Revise os pontos: bônus devem ficar entre 0 e 1, ônus entre -1 e 0 e a votação entre 1 e 30 dias."},{status:400});
  const previous=careerConfigFromRow(await db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first()),now=new Date().toISOString();
  await db().prepare(`UPDATE career_configuration SET enabled=?,winner_bonus=?,loser_penalty=?,motm_third=?,motm_second=?,motm_first=?,dotm_third=?,dotm_second=?,dotm_first=?,voting_days=?,updated_at=? WHERE id=1`).bind(config.enabled?1:0,config.winnerBonus,config.loserPenalty,config.motmThird,config.motmSecond,config.motmFirst,config.dotmThird,config.dotmSecond,config.dotmFirst,config.votingDays,now).run();
  await audit(admin.id,"UPDATE","career_configuration","1",config,previous);return Response.json({ok:true,message:"Configurações do Modo Carreira salvas."});
}

export async function POST(request:Request){const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});const payload=await request.json().catch(()=>({})) as any;try{return Response.json({ok:true,match:await finalizeCareerMatch(String(payload.matchId||""),admin.id),message:"Votação encerrada e momentum aplicado."});}catch(error:any){return Response.json({error:error.message||"Não foi possível encerrar a votação."},{status:400});}}

export async function DELETE(request:Request){const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});const voteId=new URL(request.url).searchParams.get("voteId");const vote:any=await db().prepare(`SELECT v.id,v.career_match_id,m.status FROM career_votes v JOIN career_matches m ON m.id=v.career_match_id WHERE v.id=?`).bind(voteId).first();if(!vote)return Response.json({error:"Voto não encontrado."},{status:404});if(vote.status!=="OPEN")return Response.json({error:"Votos encerrados são finais e não podem ser removidos."},{status:409});await db().prepare(`DELETE FROM career_votes WHERE id=?`).bind(voteId).run();await audit(admin.id,"DELETE","career_vote",voteId||undefined,{careerMatchId:vote.career_match_id});return Response.json({ok:true,message:"Voto removido; o jogador poderá votar novamente."});}
