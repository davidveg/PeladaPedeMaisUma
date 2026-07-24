import { careerVoteForAuthenticatedPlayer, validateCareerVote } from "../../../../lib/career";
import { careerMatchFromRow, finalizeIfExpired, getCareerConfig } from "../../../../lib/career-service";
import { audit, currentPlayerAccount, db, ensureDb } from "../../../../lib/database";

async function context(token: string) {
  await ensureDb();
  let row: any = await db().prepare(
    `SELECT c.*,s.match_title,s.match_date,s.snapshot
     FROM career_matches c
     JOIN team_separations s ON s.id=c.separation_id
     WHERE c.voting_token=? AND s.deleted_at IS NULL`,
  ).bind(token).first();
  if (!row) return null;

  await finalizeIfExpired(row);
  row = await db().prepare(
    `SELECT c.*,s.match_title,s.match_date,s.snapshot
     FROM career_matches c
     JOIN team_separations s ON s.id=c.separation_id
     WHERE c.id=?`,
  ).bind(row.id).first();

  const snapshot = JSON.parse(row.snapshot);
  const players = [
    ...(snapshot.blue || []).map((player: any) => ({ ...player, team: "BLUE" })),
    ...(snapshot.yellow || []).map((player: any) => ({ ...player, team: "YELLOW" })),
  ];
  return { row, snapshot, players };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const data = await context(token);
  const headers = { "cache-control": "no-store, max-age=0" };
  if (!data) return Response.json({ error: "Link de votação inválido." }, { status: 404, headers });

  const [config, account] = await Promise.all([getCareerConfig(), currentPlayerAccount(request)]) as [any, any];
  const match = careerMatchFromRow(data.row);
  const names = Object.fromEntries(data.players.map((player: any) => [player.id, player.displayName]));
  const voterPlayerId = String(account?.playerId || "");
  const voterPlayer = data.players.find((player: any) => player.id === voterPlayerId);
  const accountType = account?.accountType === "administrator" ? "administrator" : "member";
  const existingVote = account && voterPlayerId
    ? await db().prepare(
      `SELECT id FROM career_votes
       WHERE career_match_id=?
         AND (voter_player_id=? OR (voter_account_type=? AND voter_account_id=?))`,
    ).bind(data.row.id, voterPlayerId, accountType, account.id).first()
    : null;
  const expired = new Date(data.row.closes_at).getTime() <= Date.now();

  let contributions: any[] = [];
  if (config.trackContributions) {
    const rows = (await db().prepare(
      `SELECT scorer_player_id,assist_player_id,team,is_own_goal
       FROM career_match_contributions
       WHERE career_match_id=?
       ORDER BY created_at`,
    ).bind(data.row.id).all()).results as any[];
    contributions = rows.map(goal => ({
      team: goal.team,
      scorerName: names[goal.scorer_player_id] || "Jogador",
      assistName: goal.assist_player_id ? names[goal.assist_player_id] || "Jogador" : null,
      ownGoal: Boolean(goal.is_own_goal),
    }));
  }

  return Response.json({
    enabled: config.enabled,
    showContributions: config.trackContributions,
    match: { ...match, matchTitle: data.row.match_title, matchDate: data.row.match_date, contributions },
    players: data.players.map((player: any) => ({
      id: player.id,
      displayName: player.displayName,
      primaryPosition: player.primaryPosition,
      photoUrl: player.photoUrl,
      team: player.team,
    })),
    viewer: {
      authenticated: Boolean(account),
      accountType: account?.accountType || null,
      hasPlayerAssociation: Boolean(voterPlayerId),
      player: voterPlayer ? { id: voterPlayer.id, displayName: voterPlayer.displayName, team: voterPlayer.team } : null,
      isParticipant: Boolean(voterPlayer),
      hasVoted: Boolean(existingVote),
      canVote: Boolean(account && voterPlayer && !existingVote && config.enabled && data.row.status === "OPEN" && !expired),
    },
  }, { headers });
}

export async function POST(request: Request) {
  const account: any = await currentPlayerAccount(request);
  if (!account) return Response.json({ error: "Faça login com sua conta de jogador para votar." }, { status: 401 });
  if (!account.playerId) return Response.json({ error: "Associe sua conta a um jogador antes de votar." }, { status: 403 });

  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const token = String(payload.token || "");
  const data = await context(token);
  if (!data) return Response.json({ error: "Link de votação inválido." }, { status: 404 });

  const config = await getCareerConfig();
  if (!config.enabled) return Response.json({ error: "O Modo Carreira está temporariamente desativado." }, { status: 403 });
  if (data.row.status !== "OPEN") return Response.json({ error: "Esta votação já foi encerrada e os resultados são finais." }, { status: 409 });
  if (new Date(data.row.closes_at).getTime() <= Date.now()) return Response.json({ error: "O prazo desta votação terminou." }, { status: 409 });

  const vote = careerVoteForAuthenticatedPlayer(payload, String(account.playerId));
  const validation = validateCareerVote(vote, data.players.map((player: any) => player.id));
  if (validation) return Response.json({ error: validation }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const accountType = account.accountType === "administrator" ? "administrator" : "member";
  try {
    await db().prepare(
      `INSERT INTO career_votes
       (id,career_match_id,voter_player_id,motm_third_id,motm_second_id,motm_first_id,dotm_third_id,dotm_second_id,dotm_first_id,created_at,voter_account_type,voter_account_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      data.row.id,
      vote.voterPlayerId,
      vote.motmThirdId,
      vote.motmSecondId,
      vote.motmFirstId,
      vote.dotmThirdId,
      vote.dotmSecondId,
      vote.dotmFirstId,
      now,
      accountType,
      account.id,
    ).run();
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      return Response.json({ error: "Você já registrou um voto nesta partida pelo site ou aplicativo." }, { status: 409 });
    }
    throw error;
  }

  await audit(accountType === "administrator" ? account.id : null, "CAREER_VOTE", "career_vote", id, {
    careerMatchId: data.row.id,
    voterPlayerId: vote.voterPlayerId,
    voterAccountId: account.id,
    voterAccountType: accountType,
  });
  return Response.json({ ok: true, message: "Voto registrado. Obrigado por participar!" }, { status: 201 });
}
