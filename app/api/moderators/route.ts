/* Moderator administration is intentionally restricted to full administrators. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db, ensureDb } from "../../../lib/database";
import { isModeratorPermission, MODERATOR_PERMISSION_DEFINITIONS } from "../../../lib/moderator-permissions";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();
  const [accounts, permissions] = await Promise.all([
    db().prepare(`SELECT a.id,a.email,a.role,a.active,a.created_at,a.last_login_at,l.player_id,p.display_name player_name FROM member_accounts a LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id LEFT JOIN players p ON p.id=l.player_id ORDER BY CASE WHEN a.role='moderator' THEN 0 ELSE 1 END,p.display_name,a.email`).all(),
    db().prepare(`SELECT member_account_id,permission FROM moderator_permissions WHERE enabled=1 ORDER BY permission`).all(),
  ]);
  const byAccount = new Map<string,string[]>();
  for (const row of permissions.results as any[]) {
    const list = byAccount.get(String(row.member_account_id)) || [];
    list.push(String(row.permission)); byAccount.set(String(row.member_account_id), list);
  }
  return Response.json({
    permissionDefinitions: MODERATOR_PERMISSION_DEFINITIONS,
    accounts: accounts.results.map((row:any)=>({
      id:row.id,email:row.email,role:row.role||"member",active:Boolean(row.active),playerId:row.player_id||null,
      playerName:row.player_name||null,createdAt:row.created_at,lastLoginAt:row.last_login_at,
      permissions:byAccount.get(String(row.id))||[],
    })),
  }, { headers: noStore });
}

export async function POST(request: Request) {
  const administrator:any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const payload = await request.json().catch(()=>({})) as any, accountId=String(payload.accountId||"");
  const requestedPermissions=Array.isArray(payload.permissions)?payload.permissions:[];
  const permissions=Array.from(new Set(requestedPermissions.filter(isModeratorPermission)));
  if(requestedPermissions.length!==permissions.length)return Response.json({error:"Uma ou mais permissões são inválidas."},{status:400,headers:noStore});
  const account:any = await db().prepare(`SELECT id,email,role,active FROM member_accounts WHERE id=?`).bind(accountId).first();
  if(!account)return Response.json({error:"Conta de jogador não encontrada."},{status:404,headers:noStore});
  if(account.role==="moderator")return Response.json({error:"Esta conta já possui o perfil moderador."},{status:409,headers:noStore});
  if(!account.active)return Response.json({error:"Ative a conta de jogador antes de promovê-la a moderador."},{status:409,headers:noStore});
  const now=new Date().toISOString();
  await db().batch([
    db().prepare(`UPDATE member_accounts SET role='moderator',updated_at=? WHERE id=?`).bind(now,accountId),
    ...permissions.map(permission=>db().prepare(`INSERT INTO moderator_permissions (member_account_id,permission,enabled,updated_at,updated_by_administrator_id) VALUES (?,?,1,?,?)`).bind(accountId,permission,now,administrator.id)),
  ]);
  await audit(administrator.id,"MEMBER_PROMOTED_TO_MODERATOR","member_account",accountId,{email:account.email,role:"moderator",permissions},{role:account.role||"member"});
  return Response.json({ok:true,message:`${account.email} agora possui o perfil moderador com ${permissions.length} permissão(ões).`},{status:201,headers:noStore});
}

export async function PUT(request: Request) {
  const administrator:any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const payload=await request.json().catch(()=>({})) as any,accountId=String(payload.accountId||"");
  const permissions=Array.from(new Set((Array.isArray(payload.permissions)?payload.permissions:[]).filter(isModeratorPermission)));
  if((Array.isArray(payload.permissions)?payload.permissions:[]).length!==permissions.length)return Response.json({error:"Uma ou mais permissões são inválidas."},{status:400,headers:noStore});
  const account:any=await db().prepare(`SELECT id,email,role FROM member_accounts WHERE id=?`).bind(accountId).first();
  if(!account||account.role!=="moderator")return Response.json({error:"Moderador não encontrado."},{status:404,headers:noStore});
  const previous=(await db().prepare(`SELECT permission FROM moderator_permissions WHERE member_account_id=? AND enabled=1 ORDER BY permission`).bind(accountId).all()).results.map((row:any)=>row.permission);
  const now=new Date().toISOString();
  await db().batch([
    db().prepare(`DELETE FROM moderator_permissions WHERE member_account_id=?`).bind(accountId),
    ...permissions.map(permission=>db().prepare(`INSERT INTO moderator_permissions (member_account_id,permission,enabled,updated_at,updated_by_administrator_id) VALUES (?,?,1,?,?)`).bind(accountId,permission,now,administrator.id)),
  ]);
  await audit(administrator.id,"MODERATOR_PERMISSIONS_UPDATED","member_account",accountId,{email:account.email,permissions},{permissions:previous});
  return Response.json({ok:true,message:"Permissões do moderador atualizadas.",permissions},{headers:noStore});
}

export async function DELETE(request: Request) {
  const administrator:any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const accountId=new URL(request.url).searchParams.get("accountId")||"";
  const account:any=await db().prepare(`SELECT id,email,role FROM member_accounts WHERE id=?`).bind(accountId).first();
  if(!account||account.role!=="moderator")return Response.json({error:"Moderador não encontrado."},{status:404,headers:noStore});
  const previous=(await db().prepare(`SELECT permission FROM moderator_permissions WHERE member_account_id=? AND enabled=1 ORDER BY permission`).bind(accountId).all()).results.map((row:any)=>row.permission);
  const now=new Date().toISOString();
  await db().batch([
    db().prepare(`UPDATE member_accounts SET role='member',updated_at=? WHERE id=?`).bind(now,accountId),
    db().prepare(`DELETE FROM moderator_permissions WHERE member_account_id=?`).bind(accountId),
  ]);
  await audit(administrator.id,"MODERATOR_REVERTED_TO_MEMBER","member_account",accountId,{email:account.email,role:"member"},{role:"moderator",permissions:previous});
  return Response.json({ok:true,message:`${account.email} voltou a ser uma conta de jogador comum.`},{headers:noStore});
}
