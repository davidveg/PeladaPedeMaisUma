/* The protected panel accepts full administrators and explicitly authorized moderators. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, currentStaff, db, ensureDb, hashPassword, verifyPassword } from "../../../lib/database";

const cookie=(name:string,value:string,maxAge:number)=>`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export async function GET(request:Request){
  const staff:any=await currentStaff(request),headers=new Headers({"content-type":"application/json","cache-control":"no-store, max-age=0",pragma:"no-cache"});
  if(!staff&&/(?:^|;\s*)ppm_session=/.test(request.headers.get("cookie")||""))headers.append("set-cookie",cookie("ppm_session","",0));
  if(!staff&&/(?:^|;\s*)ppm_member_session=/.test(request.headers.get("cookie")||""))headers.append("set-cookie",cookie("ppm_member_session","",0));
  return new Response(JSON.stringify({admin:staff}),{headers});
}

export async function POST(request:Request){
  await ensureDb();const payload=await request.json().catch(()=>({})) as any,email=String(payload.email||"").trim().toLowerCase(),password=String(payload.password||"");
  const administrator:any=await db().prepare(`SELECT *,'administrator' account_type,'administrator' role FROM administrators WHERE email=? AND active=1`).bind(email).first();
  const moderator:any=administrator?null:await db().prepare(`SELECT *,'member' account_type FROM member_accounts WHERE email=? AND active=1 AND role='moderator'`).bind(email).first();
  const account=administrator&&await verifyPassword(password,administrator.password_hash)?administrator:moderator&&await verifyPassword(password,moderator.password_hash)?moderator:null;
  if(!account)return Response.json({error:"Usuário ou senha inválidos."},{status:401});
  const token=crypto.randomUUID(),now=new Date(),expires=new Date(now.getTime()+8*60*60*1000),isAdministrator=account.account_type==="administrator";
  if(isAdministrator){
    await db().batch([
      db().prepare(`INSERT INTO sessions VALUES (?,?,?,?)`).bind(token,account.id,expires.toISOString(),now.toISOString()),
      db().prepare(`UPDATE administrators SET last_login_at=? WHERE id=?`).bind(now.toISOString(),account.id),
    ]);
  }else{
    await db().batch([
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind(token,account.id,expires.toISOString(),now.toISOString()),
      db().prepare(`UPDATE member_accounts SET last_login_at=?,updated_at=? WHERE id=?`).bind(now.toISOString(),now.toISOString(),account.id),
    ]);
  }
  await audit(account.id,"LOGIN",isAdministrator?"administrator":"moderator",account.id,{panel:"protected"});
  const staff:any=await currentStaff(new Request(request.url,{headers:{cookie:`${isAdministrator?"ppm_session":"ppm_member_session"}=${token}`}}));
  return new Response(JSON.stringify({admin:staff}),{headers:{"content-type":"application/json","set-cookie":cookie(isAdministrator?"ppm_session":"ppm_member_session",token,28800)}});
}

export async function PUT(request:Request){
  const staff:any=await currentStaff(request);if(!staff||staff.accountType!=="administrator")return Response.json({error:"Não autorizado"},{status:401});
  const payload=await request.json() as any;if(!/^\S+@\S+\.\S+$/.test(payload.email)||!payload.password||payload.password.length<8||payload.password==="admin")return Response.json({error:"Informe e-mail válido e senha de ao menos 8 caracteres."},{status:400});
  const hash=await hashPassword(payload.password),email=payload.email.toLowerCase();await db().prepare(`UPDATE administrators SET email=?,password_hash=?,must_change_password=0,updated_at=? WHERE id=?`).bind(email,hash,new Date().toISOString(),staff.id).run();await audit(staff.id,"CHANGE_PASSWORD","administrator",staff.id,{email,passwordChanged:true},{email:staff.email});return Response.json({ok:true});
}

export async function DELETE(request:Request){
  const staff:any=await currentStaff(request),cookies=request.headers.get("cookie")||"",adminToken=cookies.match(/ppm_session=([^;]+)/)?.[1],memberToken=cookies.match(/ppm_member_session=([^;]+)/)?.[1];
  if(adminToken)await db().prepare(`DELETE FROM sessions WHERE id=?`).bind(adminToken).run();if(memberToken)await db().prepare(`DELETE FROM member_sessions WHERE id=?`).bind(memberToken).run();
  if(staff)await audit(staff.id,"LOGOUT",staff.accountType==="administrator"?"administrator":"moderator",staff.id);
  const headers=new Headers({"content-type":"application/json"});headers.append("set-cookie",cookie("ppm_session","",0));headers.append("set-cookie",cookie("ppm_member_session","",0));return new Response(JSON.stringify({ok:true}),{headers});
}
