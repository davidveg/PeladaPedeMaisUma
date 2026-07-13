import { env } from "cloudflare:workers";

const statements = [
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, display_name TEXT NOT NULL, nickname TEXT, aliases TEXT NOT NULL DEFAULT '[]', type TEXT NOT NULL DEFAULT 'monthly', primary_position TEXT NOT NULL, speed REAL NOT NULL, skill REAL NOT NULL, marking REAL NOT NULL DEFAULT 3, photo_url TEXT, active INTEGER NOT NULL DEFAULT 1, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS administrators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS team_separations (id TEXT PRIMARY KEY, match_title TEXT NOT NULL, match_date TEXT, location TEXT, original_text TEXT NOT NULL, snapshot TEXT NOT NULL, manually_adjusted INTEGER NOT NULL DEFAULT 0, balance_score REAL NOT NULL, balance_classification TEXT NOT NULL, confirmed_at TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS system_configuration (id INTEGER PRIMARY KEY, default_player_count INTEGER NOT NULL, minimum_recommended_players INTEGER NOT NULL, maximum_recommended_players INTEGER NOT NULL, speed_weight REAL NOT NULL, skill_weight REAL NOT NULL, maximum_position_difference INTEGER NOT NULL, protected_top_players_percentage REAL NOT NULL, default_reserve_count INTEGER NOT NULL, algorithm_attempts INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, administrator_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, previous_data TEXT, new_data TEXT, created_at TEXT NOT NULL)`,
];
let ready: Promise<void> | undefined;
export function db() { return env.DB as D1Database; }
export async function ensureDb() {
  if (!ready) ready=(async()=>{ const d=db(); for(const sql of statements) await d.prepare(sql).run(); const columns=await d.prepare(`PRAGMA table_info(players)`).all(); if(!columns.results.some((column:any)=>column.name==="marking")) await d.prepare(`ALTER TABLE players ADD COLUMN marking REAL NOT NULL DEFAULT 3`).run(); const now=new Date().toISOString(); await d.prepare(`INSERT OR IGNORE INTO system_configuration VALUES (1,22,14,30,.6,.4,1,.25,0,2500,?)`).bind(now).run(); await seed(d,now); })();
  return ready;
}
async function seed(d:D1Database, now:string){
  const admin=await d.prepare(`SELECT id FROM administrators LIMIT 1`).first();
  if(!admin){ const hash=await hashPassword("admin"); await d.prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),"admin",hash,1,1,now,now).run(); }
  const count=await d.prepare(`SELECT COUNT(*) total FROM players`).first<{total:number}>(); if((count?.total||0)>0)return;
  const samples=[
    ["William","Defesa",4.2,3.8],["Cussa","Ataque",4.4,4.2],["Guillaume","Meio-campo",3.8,4.5],["Roberto","Defesa",3.5,4.0],["Marcio","Meio-campo",4.1,3.7],["Thiago C","Ataque",4.6,4.1],["Gaspar","Defesa",3.9,3.8],["Mateus","Meio-campo",4.3,4.4],["Pedro Henrique","Ataque",3.7,4.6],["Antonio","Goleiro",3.5,3.8],["Felipe G","Defesa",4.0,3.6],["David","Meio-campo",3.9,4.1]
  ];
  for(const [name,pos,speed,skill] of samples) await d.prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),name,name,name,"[]",pos==="Goleiro"?"goalkeeper":"monthly",pos,speed,skill,1,now,now).run();
}
export async function hashPassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`}
export async function verifyPassword(password:string,stored:string){const [saltHex,want]=stored.split(":");const salt=Uint8Array.from(saltHex.match(/.{2}/g)||[],x=>parseInt(x,16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);return toHex(new Uint8Array(bits))===want}
const toHex=(b:Uint8Array)=>[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function currentAdmin(request:Request){await ensureDb();const token=(request.headers.get("cookie")||"").match(/ppm_session=([^;]+)/)?.[1];if(!token)return null;return db().prepare(`SELECT a.id,a.email,a.active,a.must_change_password mustChangePassword FROM sessions s JOIN administrators a ON a.id=s.administrator_id WHERE s.id=? AND s.expires_at>? AND a.active=1`).bind(token,new Date().toISOString()).first();}
export function adminRequired(request:Request){return currentAdmin(request)}
export async function audit(adminId:string|null,action:string,entityType:string,entityId?:string,newData?:unknown,previousData?:unknown){await db().prepare(`INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),adminId,action,entityType,entityId||null,previousData?JSON.stringify(previousData):null,newData?JSON.stringify(newData):null,new Date().toISOString()).run()}
