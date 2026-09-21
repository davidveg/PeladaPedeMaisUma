import { getCareerConfig } from "../../../../lib/career-service";
import { audit, db, ensureDb, staffRequired } from "../../../../lib/database";
import { normalizeDraftParticipation, normalizeDraftScore, scoresFromContributions, validateMatchDraft } from "../../../../lib/match-draft";
import { effectiveParticipation } from "../../../../lib/match-participation";
const adminRequired=(request:Request)=>staffRequired(request,"MATCH_RESULTS_MANAGE");

async function draftContext(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return { error: Response.json({ error: "Não autorizado" }, { status: 401 }) };
  await ensureDb();
  const separationId = new URL(request.url).searchParams.get("separationId") || "";
  const row: any = await db().prepare(`SELECT s.id,s.match_title,s.match_date,s.snapshot,s.match_draft,c.id career_id,c.participation_snapshot FROM team_separations s LEFT JOIN career_matches c ON c.separation_id=s.id WHERE s.id=? AND s.deleted_at IS NULL`).bind(separationId).first();
  if (!row) return { error: Response.json({ error: "Escalação não encontrada." }, { status: 404 }) };
  const snapshot = JSON.parse(row.snapshot);
  return { admin, row, snapshot, separationId };
}

function publicDraft(row: any, snapshot: any, eligiblePlayers: any[]) {
  const stored = row.match_draft ? JSON.parse(row.match_draft) : { contributions: [], updatedAt: null };
  const contributions = Array.isArray(stored.contributions) ? stored.contributions : [];
  const current = effectiveParticipation({ ...row, snapshot });
  const fallback = { blueIds: current.blue.map((player: any) => String(player.id)), yellowIds: current.yellow.map((player: any) => String(player.id)) };
  const participation = normalizeDraftParticipation(stored.participation, eligiblePlayers.map(player => String(player.id)), fallback);
  const contributionScores = scoresFromContributions(contributions);
  return {
    separationId: row.id,
    matchTitle: row.match_title,
    matchDate: row.match_date,
    officialResultConfirmed: Boolean(row.career_id),
    players: {
      blue: (snapshot.blue || []).map((player: any) => ({ id: player.id, displayName: player.displayName, photoUrl: player.photoUrl, primaryPosition: player.primaryPosition })),
      yellow: (snapshot.yellow || []).map((player: any) => ({ id: player.id, displayName: player.displayName, photoUrl: player.photoUrl, primaryPosition: player.primaryPosition })),
    },
    participation: { reviewed: Boolean(participation.reviewed || row.participation_snapshot), blueIds: participation.blueIds, yellowIds: participation.yellowIds },
    eligiblePlayers,
    draft: { contributions, blueScore: normalizeDraftScore(stored.blueScore) ?? contributionScores.blueScore, yellowScore: normalizeDraftScore(stored.yellowScore) ?? contributionScores.yellowScore, participation: { blueIds: participation.blueIds, yellowIds: participation.yellowIds }, updatedAt: stored.updatedAt || null },
  };
}

export async function GET(request: Request) {
  const context: any = await draftContext(request);
  if (context.error) return context.error;
  const config = await getCareerConfig();
  const players=(await db().prepare(`SELECT id,display_name,photo_url,primary_position,secondary_position,type FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all()).results as any[];
  const activePlayers=players.map(player=>({id:String(player.id),displayName:String(player.display_name),photoUrl:player.photo_url||null,primaryPosition:player.primary_position||null,secondaryPosition:player.secondary_position||null,type:player.type||null}));
  const current=effectiveParticipation({ ...context.row, snapshot: context.snapshot });
  const eligiblePlayers=Array.from(new Map([...activePlayers,...current.blue,...current.yellow].map((player:any)=>[String(player.id),player])).values()).sort((left:any,right:any)=>String(left.displayName).localeCompare(String(right.displayName),"pt-BR"));
  return Response.json({ ...publicDraft(context.row, context.snapshot, eligiblePlayers), enabled: config.enabled, trackContributions: config.trackContributions }, { headers: { "cache-control": "no-store, max-age=0" } });
}

export async function PUT(request: Request) {
  const context: any = await draftContext(request);
  if (context.error) return context.error;
  if (context.row.career_id) return Response.json({ error: "O resultado desta partida já foi confirmado." }, { status: 409 });
  const config = await getCareerConfig();
  if (!config.enabled) return Response.json({ error: "O Modo Carreira está desativado." }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as any;
  const playerRows=(await db().prepare(`SELECT id FROM players WHERE deleted_at IS NULL AND active=1`).all()).results as any[];
  const lineupIds=[...(context.snapshot.blue||[]),...(context.snapshot.yellow||[])].map((player:any)=>String(player.id));
  const eligibleIds=[...new Set([...playerRows.map(player=>String(player.id)),...lineupIds])];
  const fallback={blueIds:(context.snapshot.blue||[]).map((player:any)=>String(player.id)),yellowIds:(context.snapshot.yellow||[]).map((player:any)=>String(player.id))};
  const participation=normalizeDraftParticipation(payload.participation,eligibleIds,fallback);
  if(participation.error)return Response.json({error:participation.error},{status:400});
  let contributions:any[]=[],blueScore=normalizeDraftScore(payload.blueScore),yellowScore=normalizeDraftScore(payload.yellowScore);
  if(config.trackContributions){const validation=validateMatchDraft({contributions:payload.contributions,blueIds:participation.blueIds,yellowIds:participation.yellowIds});if(validation.error)return Response.json({error:validation.error},{status:400});contributions=validation.contributions;blueScore=validation.blueScore;yellowScore=validation.yellowScore}
  else if(blueScore===null||yellowScore===null)return Response.json({error:"Informe um placar entre 0 e 99 para cada equipe."},{status:400});
  const previous = context.row.match_draft ? JSON.parse(context.row.match_draft) : null;
  const now = new Date().toISOString();
  const next = { contributions, blueScore, yellowScore, participation:{blueIds:participation.blueIds,yellowIds:participation.yellowIds}, updatedAt: now, updatedByAdministratorId: context.admin.id };
  await db().prepare(`UPDATE team_separations SET match_draft=?,updated_at=? WHERE id=?`).bind(JSON.stringify(next), now, context.separationId).run();
  await audit(context.admin.id, "UPDATE_MATCH_DRAFT", "separation", context.separationId, next, previous);
  return Response.json({ ok: true, draft: { contributions, blueScore, yellowScore, participation:next.participation, updatedAt: now }, message: "Rascunho da partida salvo." });
}
