/* D1 and untrusted JSON payloads are narrowed explicitly at each use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb, playerAccountRequired, verifyPassword } from "../../../../lib/database";
import { createMobileSession, revokeMobileSession, rotateMobileSession } from "../../../../lib/mobile-auth";

const noStore = { "cache-control": "no-store", "content-type": "application/json" };

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  return account ? Response.json({ account: publicAccount(account) }, { headers: noStore }) : Response.json({ error: "Sessão expirada." }, { status: 401, headers: noStore });
}

export async function POST(request: Request) {
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  const email = String(payload.email || "").trim().toLowerCase(), password = String(payload.password || "");
  if (!email || !password || password.length > 256) return Response.json({ error: "Informe e-mail e senha." }, { status: 400, headers: noStore });
  const member: any = await db().prepare(`SELECT *,'member' account_type FROM member_accounts WHERE email=?`).bind(email).first();
  const admin: any = await db().prepare(`SELECT *,'administrator' account_type FROM administrators WHERE email=?`).bind(email).first();
  const candidate = member && await verifyPassword(password, member.password_hash) ? member : admin && await verifyPassword(password, admin.password_hash) ? admin : null;
  if (!candidate) return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401, headers: noStore });
  if (!candidate.active) return Response.json({ error: "Esta conta está desativada. Procure o administrador." }, { status: 403, headers: noStore });
  if (candidate.account_type === "administrator" && candidate.must_change_password) return Response.json({ error: "Conclua o primeiro acesso na aplicação web antes de entrar no aplicativo." }, { status: 403, headers: noStore });
  const accountType = candidate.account_type as "administrator" | "member", session = await createMobileSession({ id: candidate.id, accountType }, payload.deviceName);
  const now = new Date().toISOString(), table = accountType === "administrator" ? "administrators" : "member_accounts";
  await db().prepare(`UPDATE ${table} SET last_login_at=?,updated_at=? WHERE id=?`).bind(now, now, candidate.id).run();
  await audit(accountType === "administrator" ? candidate.id : null, "MOBILE_LOGIN", accountType, candidate.id, { sessionId: session.id, deviceName: String(payload.deviceName || "").slice(0, 120) });
  return Response.json({ account: await loadAccount(accountType, candidate.id), ...session }, { status: 201, headers: noStore });
}

export async function PUT(request: Request) {
  const payload = await request.json().catch(() => ({})) as any, result = await rotateMobileSession(String(payload.refreshToken || ""), payload.deviceName);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status, headers: noStore });
  return Response.json({ account: await loadAccount(result.accountType, (await db().prepare(`SELECT account_id FROM mobile_sessions WHERE id=?`).bind(result.session.id).first<any>())!.account_id), ...result.session }, { headers: noStore });
}

export async function DELETE(request: Request) {
  const payload = await request.json().catch(() => ({})) as any;
  await revokeMobileSession(request, payload.refreshToken ? String(payload.refreshToken) : undefined);
  return Response.json({ ok: true }, { headers: noStore });
}

async function loadAccount(accountType: "administrator" | "member", id: string) {
  const account: any = accountType === "administrator"
    ? await db().prepare(`SELECT a.id,a.email,l.player_id playerId,'administrator' accountType FROM administrators a LEFT JOIN player_account_links l ON l.account_type='administrator' AND l.account_id=a.id WHERE a.id=?`).bind(id).first()
    : await db().prepare(`SELECT a.id,a.email,l.player_id playerId,'member' accountType FROM member_accounts a LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id WHERE a.id=?`).bind(id).first();
  return publicAccount(account);
}

const publicAccount = (account: any) => ({ id: account.id, email: account.email, role: account.accountType === "administrator" ? "admin" : "player", playerId: account.playerId || null });
