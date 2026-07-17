import { audit, currentPlayerAccount, db, ensureDb, hashPassword, verifyPassword } from "../../../lib/database";

const emailPattern = /^\S+@\S+\.\S+$/;
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export async function GET(request: Request) {
  return Response.json({ member: await currentPlayerAccount(request) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const memberAccount: any = await db().prepare(`SELECT *,'member' account_type FROM member_accounts WHERE email=? AND active=1`).bind(email).first();
  const administratorAccount: any = await db().prepare(`SELECT *,'administrator' account_type FROM administrators WHERE email=? AND active=1`).bind(email).first();
  const account: any = memberAccount && await verifyPassword(password, memberAccount.password_hash) ? memberAccount : administratorAccount && await verifyPassword(password, administratorAccount.password_hash) ? administratorAccount : null;
  if (!account) return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  if (account.account_type === "administrator" && account.must_change_password) return Response.json({ error: "Conclua o primeiro acesso no painel administrativo antes de usar a área do jogador." }, { status: 403 });
  const id = crypto.randomUUID(), now = new Date(), expires = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const administrator = account.account_type === "administrator";
  await db().batch(administrator ? [
    db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind(id, account.id, expires.toISOString(), now.toISOString()),
    db().prepare(`UPDATE administrators SET last_login_at=?,updated_at=? WHERE id=?`).bind(now.toISOString(), now.toISOString(), account.id),
  ] : [
    db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind(id, account.id, expires.toISOString(), now.toISOString()),
    db().prepare(`UPDATE member_accounts SET last_login_at=?,updated_at=? WHERE id=?`).bind(now.toISOString(), now.toISOString(), account.id),
  ]);
  await audit(administrator ? account.id : null, "MEMBER_LOGIN", administrator ? "administrator" : "member_account", account.id, { email, portal: "player" });
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": cookie(administrator ? "ppm_session" : "ppm_member_session", id, administrator ? 8 * 60 * 60 : 30 * 24 * 60 * 60) } });
}

export async function PUT(request: Request) {
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  const email = String(payload.email || "").trim().toLowerCase(), password = String(payload.password || ""), confirmation = String(payload.confirmation || "");
  if (!emailPattern.test(email)) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (password !== confirmation) return Response.json({ error: "A confirmação da senha não corresponde." }, { status: 400 });
  if (await db().prepare(`SELECT id FROM administrators WHERE email=?`).bind(email).first()) return Response.json({ error: "Este e-mail já pertence a uma conta administrativa. Use a opção Entrar." }, { status: 409 });
  const id = crypto.randomUUID(), sessionId = crypto.randomUUID(), now = new Date(), expires = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  try {
    await db().batch([
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,player_id,active,created_at,updated_at) VALUES (?,?,?,NULL,1,?,?)`).bind(id, email, await hashPassword(password), now.toISOString(), now.toISOString()),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind(sessionId, id, expires.toISOString(), now.toISOString()),
    ]);
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) return Response.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    throw error;
  }
  await audit(null, "MEMBER_REGISTER", "member_account", id, { email });
  return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json", "set-cookie": cookie("ppm_member_session", sessionId, 30 * 24 * 60 * 60) } });
}

export async function DELETE(request: Request) {
  const member: any = await currentPlayerAccount(request), cookies = request.headers.get("cookie") || "";
  const memberToken = cookies.match(/ppm_member_session=([^;]+)/)?.[1], adminToken = cookies.match(/ppm_session=([^;]+)/)?.[1];
  if (memberToken) await db().prepare(`DELETE FROM member_sessions WHERE id=?`).bind(memberToken).run();
  if (adminToken) await db().prepare(`DELETE FROM sessions WHERE id=?`).bind(adminToken).run();
  if (member) await audit(member.accountType === "administrator" ? member.id : null, "MEMBER_LOGOUT", member.accountType === "administrator" ? "administrator" : "member_account", member.id, { email: member.email, portal: "player" });
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", cookie("ppm_member_session", "", 0)); headers.append("set-cookie", cookie("ppm_session", "", 0));
  return new Response(JSON.stringify({ ok: true }), { headers });
}
