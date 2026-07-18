import { getRuntimeBindings } from "./runtime-bindings";
import { logEvent } from "./logger";

const statements = [
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, display_name TEXT NOT NULL, nickname TEXT, aliases TEXT NOT NULL DEFAULT '[]', type TEXT NOT NULL DEFAULT 'monthly', primary_position TEXT NOT NULL, speed REAL NOT NULL, skill REAL NOT NULL, marking REAL NOT NULL DEFAULT 3, goalkeeper_positioning REAL NOT NULL DEFAULT 3, goal_exit REAL NOT NULL DEFAULT 3, momentum REAL NOT NULL DEFAULT 0, photo_url TEXT, active INTEGER NOT NULL DEFAULT 1, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS administrators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, player_id TEXT UNIQUE, active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_sessions (id TEXT PRIMARY KEY, member_account_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_sessions_account_idx ON member_sessions(member_account_id)`,
  `CREATE TABLE IF NOT EXISTS player_account_links (player_id TEXT PRIMARY KEY, account_type TEXT NOT NULL, account_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS team_separations (id TEXT PRIMARY KEY, match_title TEXT NOT NULL, match_date TEXT, location TEXT, original_text TEXT NOT NULL, snapshot TEXT NOT NULL, manually_adjusted INTEGER NOT NULL DEFAULT 0, arrival_order TEXT, balance_score REAL NOT NULL, balance_classification TEXT NOT NULL, confirmed_at TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS system_configuration (id INTEGER PRIMARY KEY, default_player_count INTEGER NOT NULL, minimum_recommended_players INTEGER NOT NULL, maximum_recommended_players INTEGER NOT NULL, speed_weight REAL NOT NULL, skill_weight REAL NOT NULL, marking_weight REAL NOT NULL, maximum_position_difference INTEGER NOT NULL, protected_top_players_percentage REAL NOT NULL, default_reserve_count INTEGER NOT NULL, algorithm_attempts INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, administrator_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, previous_data TEXT, new_data TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_configuration (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, track_contributions INTEGER NOT NULL DEFAULT 1, momentum_multiplier REAL NOT NULL DEFAULT 1, winner_bonus REAL NOT NULL DEFAULT 0.1, loser_penalty REAL NOT NULL DEFAULT -0.1, motm_third REAL NOT NULL DEFAULT 0.1, motm_second REAL NOT NULL DEFAULT 0.2, motm_first REAL NOT NULL DEFAULT 0.3, dotm_third REAL NOT NULL DEFAULT -0.1, dotm_second REAL NOT NULL DEFAULT -0.2, dotm_first REAL NOT NULL DEFAULT -0.3, voting_days INTEGER NOT NULL DEFAULT 5, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_matches (id TEXT PRIMARY KEY, separation_id TEXT NOT NULL UNIQUE, blue_score INTEGER NOT NULL, yellow_score INTEGER NOT NULL, winner_team TEXT NOT NULL, voting_token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'OPEN', closes_at TEXT NOT NULL, closed_at TEXT, created_by_administrator_id TEXT NOT NULL, config_snapshot TEXT NOT NULL, results_snapshot TEXT, team_momentum_applied INTEGER NOT NULL DEFAULT 0, votes_momentum_applied INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_votes (id TEXT PRIMARY KEY, career_match_id TEXT NOT NULL, voter_player_id TEXT NOT NULL, motm_third_id TEXT NOT NULL, motm_second_id TEXT NOT NULL, motm_first_id TEXT NOT NULL, dotm_third_id TEXT NOT NULL, dotm_second_id TEXT NOT NULL, dotm_first_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(career_match_id,voter_player_id))`,
  `CREATE INDEX IF NOT EXISTS career_votes_match_idx ON career_votes(career_match_id)`,
  `CREATE TABLE IF NOT EXISTS career_match_contributions (id TEXT PRIMARY KEY, career_match_id TEXT NOT NULL, scorer_player_id TEXT NOT NULL, assist_player_id TEXT, team TEXT NOT NULL, is_own_goal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS career_match_contributions_match_idx ON career_match_contributions(career_match_id)`,
  `CREATE INDEX IF NOT EXISTS career_match_contributions_scorer_idx ON career_match_contributions(scorer_player_id)`,
  `CREATE INDEX IF NOT EXISTS career_match_contributions_assist_idx ON career_match_contributions(assist_player_id)`,
];
let ready: Promise<void> | undefined;
export function db() { return getRuntimeBindings().DB; }
export async function ensureDb() {
  if (!ready) ready=(async()=>{
    const d=db();
    for(const sql of statements) await d.prepare(sql).run();
    const playerColumns=await d.prepare(`PRAGMA table_info(players)`).all();
    const migratedPlayerMarking=!playerColumns.results.some((column:any)=>column.name==="marking");
    if(migratedPlayerMarking) await d.prepare(`ALTER TABLE players ADD COLUMN marking REAL NOT NULL DEFAULT 3`).run();
    const migratedPlayerMomentum=!playerColumns.results.some((column:any)=>column.name==="momentum");
    if(migratedPlayerMomentum) await d.prepare(`ALTER TABLE players ADD COLUMN momentum REAL NOT NULL DEFAULT 0`).run();
    const migratedGoalkeeperPositioning=!playerColumns.results.some((column:any)=>column.name==="goalkeeper_positioning");
    if(migratedGoalkeeperPositioning) {
      await d.prepare(`ALTER TABLE players ADD COLUMN goalkeeper_positioning REAL NOT NULL DEFAULT 3`).run();
      await d.prepare(`UPDATE players SET goalkeeper_positioning=speed WHERE primary_position='Goleiro' OR type='goalkeeper'`).run();
    }
    const migratedGoalExit=!playerColumns.results.some((column:any)=>column.name==="goal_exit");
    if(migratedGoalExit) {
      await d.prepare(`ALTER TABLE players ADD COLUMN goal_exit REAL NOT NULL DEFAULT 3`).run();
      await d.prepare(`UPDATE players SET goal_exit=marking WHERE primary_position='Goleiro' OR type='goalkeeper'`).run();
    }
    const configurationColumns=await d.prepare(`PRAGMA table_info(system_configuration)`).all();
    const migratedMarkingWeight=!configurationColumns.results.some((column:any)=>column.name==="marking_weight");
    if(migratedMarkingWeight) {
      await d.prepare(`ALTER TABLE system_configuration ADD COLUMN marking_weight REAL NOT NULL DEFAULT 0.2`).run();
      await d.prepare(`UPDATE system_configuration SET speed_weight=speed_weight*0.8, skill_weight=skill_weight*0.8`).run();
    }
    const careerColumns=await d.prepare(`PRAGMA table_info(career_configuration)`).all();
    const migratedMomentumMultiplier=!careerColumns.results.some((column:any)=>column.name==="momentum_multiplier");
    if(migratedMomentumMultiplier) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN momentum_multiplier REAL NOT NULL DEFAULT 1`).run();
    const migratedTrackContributions=!careerColumns.results.some((column:any)=>column.name==="track_contributions");
    if(migratedTrackContributions) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN track_contributions INTEGER NOT NULL DEFAULT 1`).run();
    const contributionColumns=await d.prepare(`PRAGMA table_info(career_match_contributions)`).all();
    const migratedOwnGoal=!contributionColumns.results.some((column:any)=>column.name==="is_own_goal");
    if(migratedOwnGoal) await d.prepare(`ALTER TABLE career_match_contributions ADD COLUMN is_own_goal INTEGER NOT NULL DEFAULT 0`).run();
    const separationColumns=await d.prepare(`PRAGMA table_info(team_separations)`).all();
    const migratedArrivalOrder=!separationColumns.results.some((column:any)=>column.name==="arrival_order");
    if(migratedArrivalOrder) await d.prepare(`ALTER TABLE team_separations ADD COLUMN arrival_order TEXT`).run();
    const now=new Date().toISOString();
    await d.prepare(`INSERT OR IGNORE INTO player_account_links (player_id,account_type,account_id,created_at) SELECT player_id,'member',id,? FROM member_accounts WHERE player_id IS NOT NULL`).bind(now).run();
    await d.prepare(`UPDATE member_accounts SET player_id=NULL WHERE player_id IS NOT NULL`).run();
    await d.prepare(`INSERT OR IGNORE INTO system_configuration (id,default_player_count,minimum_recommended_players,maximum_recommended_players,speed_weight,skill_weight,marking_weight,maximum_position_difference,protected_top_players_percentage,default_reserve_count,algorithm_attempts,updated_at) VALUES (1,22,14,30,.48,.32,.2,1,.25,0,2500,?)`).bind(now).run();
    await d.prepare(`INSERT OR IGNORE INTO career_configuration (id,enabled,winner_bonus,loser_penalty,motm_third,motm_second,motm_first,dotm_third,dotm_second,dotm_first,voting_days,updated_at) VALUES (1,1,.1,-.1,.1,.2,.3,-.1,-.2,-.3,5,?)`).bind(now).run();
    await seed(d,now);
    logEvent("info","database_ready",{migratedPlayerMarking,migratedPlayerMomentum,migratedGoalkeeperPositioning,migratedGoalExit,migratedMarkingWeight,migratedMomentumMultiplier,migratedTrackContributions,migratedOwnGoal,migratedArrivalOrder});
  })();
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
export async function currentAdmin(request:Request){await ensureDb();const token=(request.headers.get("cookie")||"").match(/ppm_session=([^;]+)/)?.[1];if(!token)return null;return db().prepare(`SELECT a.id,a.email,a.active,a.must_change_password mustChangePassword,a.created_at createdAt,l.player_id playerId,'administrator' accountType FROM sessions s JOIN administrators a ON a.id=s.administrator_id LEFT JOIN player_account_links l ON l.account_type='administrator' AND l.account_id=a.id WHERE s.id=? AND s.expires_at>? AND a.active=1`).bind(token,new Date().toISOString()).first();}
export function adminRequired(request:Request){return currentAdmin(request)}
export async function currentMember(request:Request){await ensureDb();const token=(request.headers.get("cookie")||"").match(/ppm_member_session=([^;]+)/)?.[1];if(!token)return null;return db().prepare(`SELECT a.id,a.email,l.player_id playerId,a.created_at createdAt,'member' accountType FROM member_sessions s JOIN member_accounts a ON a.id=s.member_account_id LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id WHERE s.id=? AND s.expires_at>? AND a.active=1`).bind(token,new Date().toISOString()).first();}
export function memberRequired(request:Request){return currentMember(request)}
export async function currentPlayerAccount(request:Request){return await currentAdmin(request) || await currentMember(request)}
export function playerAccountRequired(request:Request){return currentPlayerAccount(request)}
export async function audit(adminId:string|null,action:string,entityType:string,entityId?:string,newData?:unknown,previousData?:unknown){await db().prepare(`INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),adminId,action,entityType,entityId||null,previousData?JSON.stringify(previousData):null,newData?JSON.stringify(newData):null,new Date().toISOString()).run()}
