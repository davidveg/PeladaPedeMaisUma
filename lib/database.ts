import { getRuntimeBindings } from "./runtime-bindings";
import { logEvent } from "./logger";
import { splitLegacyMomentumSources } from "./momentum-sources";

const statements = [
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, display_name TEXT NOT NULL, nickname TEXT, aliases TEXT NOT NULL DEFAULT '[]', type TEXT NOT NULL DEFAULT 'monthly', primary_position TEXT NOT NULL, speed REAL NOT NULL, skill REAL NOT NULL, marking REAL NOT NULL DEFAULT 3, goalkeeper_positioning REAL NOT NULL DEFAULT 3, goal_exit REAL NOT NULL DEFAULT 3, momentum REAL NOT NULL DEFAULT 0, result_momentum REAL NOT NULL DEFAULT 0, voting_momentum REAL NOT NULL DEFAULT 0, photo_url TEXT, active INTEGER NOT NULL DEFAULT 1, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS administrators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, player_id TEXT UNIQUE, active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_sessions (id TEXT PRIMARY KEY, member_account_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_sessions_account_idx ON member_sessions(member_account_id)`,
  `CREATE TABLE IF NOT EXISTS mobile_sessions (id TEXT PRIMARY KEY, account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')), account_id TEXT NOT NULL, access_token_hash TEXT NOT NULL UNIQUE, refresh_token_hash TEXT NOT NULL UNIQUE, access_expires_at TEXT NOT NULL, refresh_expires_at TEXT NOT NULL, revoked_at TEXT, replaced_by_session_id TEXT, device_name TEXT, last_used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS mobile_sessions_account_idx ON mobile_sessions(account_type,account_id)`,
  `CREATE INDEX IF NOT EXISTS mobile_sessions_refresh_idx ON mobile_sessions(refresh_token_hash)`,
  `CREATE TABLE IF NOT EXISTS mobile_idempotency_keys (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, operation TEXT NOT NULL, idempotency_key TEXT NOT NULL, status_code INTEGER NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(administrator_id,operation,idempotency_key))`,
  `CREATE TABLE IF NOT EXISTS mobile_push_tokens (id TEXT PRIMARY KEY, account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')), account_id TEXT NOT NULL, mobile_session_id TEXT, expo_push_token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL, device_name TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS mobile_push_tokens_account_idx ON mobile_push_tokens(account_type,account_id,active)`,
  `CREATE TABLE IF NOT EXISTS push_notification_deliveries (id TEXT PRIMARY KEY, career_match_id TEXT NOT NULL, push_token_id TEXT NOT NULL, status TEXT NOT NULL, ticket_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(career_match_id,push_token_id))`,
  `CREATE INDEX IF NOT EXISTS push_notification_deliveries_match_idx ON push_notification_deliveries(career_match_id)`,
  `CREATE TABLE IF NOT EXISTS scheduled_matches (id TEXT PRIMARY KEY, title TEXT NOT NULL, match_at TEXT NOT NULL, confirmation_deadline TEXT NOT NULL, location TEXT, max_changes INTEGER NOT NULL DEFAULT 2, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','CANCELLED')), created_by_administrator_id TEXT NOT NULL, separation_id TEXT, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS scheduled_matches_status_date_idx ON scheduled_matches(status,match_at)`,
  `CREATE TABLE IF NOT EXISTS match_attendance (id TEXT PRIMARY KEY, match_id TEXT NOT NULL, player_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('PRESENT','ABSENT')), change_count INTEGER NOT NULL DEFAULT 0, responded_by_account_type TEXT, responded_by_account_id TEXT, updated_by_administrator_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(match_id,player_id))`,
  `CREATE INDEX IF NOT EXISTS match_attendance_match_idx ON match_attendance(match_id,status)`,
  `CREATE TABLE IF NOT EXISTS account_notifications (id TEXT PRIMARY KEY, account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')), account_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, match_id TEXT, action_url TEXT, read_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS account_notifications_account_idx ON account_notifications(account_type,account_id,created_at)`,
  `CREATE TABLE IF NOT EXISTS account_notification_preferences (id TEXT PRIMARY KEY, account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')), account_id TEXT NOT NULL, attendance_in_app INTEGER NOT NULL DEFAULT 1, attendance_push INTEGER NOT NULL DEFAULT 1, matches_in_app INTEGER NOT NULL DEFAULT 1, matches_push INTEGER NOT NULL DEFAULT 1, separations_in_app INTEGER NOT NULL DEFAULT 1, separations_push INTEGER NOT NULL DEFAULT 1, app_updates_in_app INTEGER NOT NULL DEFAULT 1, app_updates_push INTEGER NOT NULL DEFAULT 1, career_votes_push INTEGER NOT NULL DEFAULT 1, page_size INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(account_type,account_id))`,
  `CREATE INDEX IF NOT EXISTS account_notification_preferences_account_idx ON account_notification_preferences(account_type,account_id)`,
  `CREATE TABLE IF NOT EXISTS mobile_release_configuration (id INTEGER PRIMARY KEY, latest_version TEXT NOT NULL DEFAULT '1.0.0', android_build INTEGER NOT NULL DEFAULT 1, ios_build INTEGER NOT NULL DEFAULT 1, minimum_android_build INTEGER NOT NULL DEFAULT 1, minimum_ios_build INTEGER NOT NULL DEFAULT 1, android_enabled INTEGER NOT NULL DEFAULT 0, ios_enabled INTEGER NOT NULL DEFAULT 0, android_url TEXT, ios_url TEXT, release_notes TEXT NOT NULL DEFAULT '', published_at TEXT, published_by_administrator_id TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notification_push_deliveries (id TEXT PRIMARY KEY, notification_id TEXT NOT NULL, push_token_id TEXT NOT NULL, status TEXT NOT NULL, ticket_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(notification_id,push_token_id))`,
  `CREATE INDEX IF NOT EXISTS notification_push_notification_idx ON notification_push_deliveries(notification_id)`,
  `CREATE TABLE IF NOT EXISTS player_account_links (player_id TEXT PRIMARY KEY, account_type TEXT NOT NULL, account_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, administrator_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_password_reset_tokens (id TEXT PRIMARY KEY, member_account_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_password_reset_account_idx ON member_password_reset_tokens(member_account_id,created_at)`,
  `CREATE TABLE IF NOT EXISTS team_separations (id TEXT PRIMARY KEY, match_title TEXT NOT NULL, match_date TEXT, location TEXT, original_text TEXT NOT NULL, snapshot TEXT NOT NULL, manually_adjusted INTEGER NOT NULL DEFAULT 0, arrival_order TEXT, match_draft TEXT, balance_score REAL NOT NULL, balance_classification TEXT NOT NULL, confirmed_at TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS system_configuration (id INTEGER PRIMARY KEY, default_player_count INTEGER NOT NULL, minimum_recommended_players INTEGER NOT NULL, maximum_recommended_players INTEGER NOT NULL, speed_weight REAL NOT NULL, skill_weight REAL NOT NULL, marking_weight REAL NOT NULL, maximum_position_difference INTEGER NOT NULL, protected_top_players_percentage REAL NOT NULL, default_reserve_count INTEGER NOT NULL, algorithm_attempts INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS instance_configuration (id INTEGER PRIMARY KEY, site_name TEXT NOT NULL DEFAULT 'Pelada Pede Mais Uma', site_short_name TEXT NOT NULL DEFAULT 'Pelada', site_tagline TEXT NOT NULL DEFAULT 'Times equilibrados. Resenha garantida.', footer_text TEXT NOT NULL DEFAULT 'Times equilibrados. Resenha garantida.', logo_url TEXT, primary_color TEXT NOT NULL DEFAULT '#174D3B', secondary_color TEXT NOT NULL DEFAULT '#D9F36B', background_color TEXT NOT NULL DEFAULT '#F5F7F3', surface_color TEXT NOT NULL DEFAULT '#FFFFFF', text_color TEXT NOT NULL DEFAULT '#15241F', muted_color TEXT NOT NULL DEFAULT '#68756F', team_blue_color TEXT NOT NULL DEFAULT '#1768E5', team_yellow_color TEXT NOT NULL DEFAULT '#F4BF20', team_blue_name TEXT NOT NULL DEFAULT 'Azul', team_yellow_name TEXT NOT NULL DEFAULT 'Amarelo', app_name TEXT NOT NULL DEFAULT 'Pelada Pede Mais Uma', app_tagline TEXT NOT NULL DEFAULT 'Entre para a partida', app_primary_color TEXT NOT NULL DEFAULT '#0B3D2E', app_secondary_color TEXT NOT NULL DEFAULT '#D9F36B', app_background_color TEXT NOT NULL DEFAULT '#F6F4EC', app_text_color TEXT NOT NULL DEFAULT '#17221D', default_match_title TEXT NOT NULL DEFAULT 'Pelada', default_match_weekday INTEGER NOT NULL DEFAULT 0, default_match_time TEXT NOT NULL DEFAULT '09:00', confirmation_lead_minutes INTEGER NOT NULL DEFAULT 60, manual_separation_enabled INTEGER NOT NULL DEFAULT 0, timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, administrator_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, previous_data TEXT, new_data TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_configuration (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, track_contributions INTEGER NOT NULL DEFAULT 1, card_tiers_enabled INTEGER NOT NULL DEFAULT 0, card_bronze_max REAL NOT NULL DEFAULT 2.4, card_silver_max REAL NOT NULL DEFAULT 3.9, card_gold_max REAL NOT NULL DEFAULT 4.5, result_momentum_multiplier REAL NOT NULL DEFAULT 1, momentum_multiplier REAL NOT NULL DEFAULT 1, winner_bonus REAL NOT NULL DEFAULT 0.1, loser_penalty REAL NOT NULL DEFAULT -0.1, motm_third REAL NOT NULL DEFAULT 0.1, motm_second REAL NOT NULL DEFAULT 0.2, motm_first REAL NOT NULL DEFAULT 0.3, dotm_third REAL NOT NULL DEFAULT -0.1, dotm_second REAL NOT NULL DEFAULT -0.2, dotm_first REAL NOT NULL DEFAULT -0.3, voting_days INTEGER NOT NULL DEFAULT 5, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_matches (id TEXT PRIMARY KEY, separation_id TEXT NOT NULL UNIQUE, blue_score INTEGER NOT NULL, yellow_score INTEGER NOT NULL, winner_team TEXT NOT NULL, voting_token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'OPEN', closes_at TEXT NOT NULL, closed_at TEXT, created_by_administrator_id TEXT NOT NULL, config_snapshot TEXT NOT NULL, results_snapshot TEXT, team_momentum_applied INTEGER NOT NULL DEFAULT 0, votes_momentum_applied INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS career_votes (id TEXT PRIMARY KEY, career_match_id TEXT NOT NULL, voter_player_id TEXT NOT NULL, motm_third_id TEXT NOT NULL, motm_second_id TEXT NOT NULL, motm_first_id TEXT NOT NULL, dotm_third_id TEXT NOT NULL, dotm_second_id TEXT NOT NULL, dotm_first_id TEXT NOT NULL, created_at TEXT NOT NULL, voter_account_type TEXT, voter_account_id TEXT, UNIQUE(career_match_id,voter_player_id))`,
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
    const migratedResultMomentum=!playerColumns.results.some((column:any)=>column.name==="result_momentum");
    if(migratedResultMomentum) await d.prepare(`ALTER TABLE players ADD COLUMN result_momentum REAL NOT NULL DEFAULT 0`).run();
    const migratedVotingMomentum=!playerColumns.results.some((column:any)=>column.name==="voting_momentum");
    if(migratedVotingMomentum) await d.prepare(`ALTER TABLE players ADD COLUMN voting_momentum REAL NOT NULL DEFAULT 0`).run();
    const momentumSourcesBackfilled=await d.prepare(`SELECT name FROM app_migrations WHERE name='split_momentum_sources_v1'`).first();
    if(!momentumSourcesBackfilled){
      await backfillMomentumSources(d);
      await d.prepare(`INSERT INTO app_migrations (name,applied_at) VALUES ('split_momentum_sources_v1',?)`).bind(new Date().toISOString()).run();
    }
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
    const instanceColumns=await d.prepare(`PRAGMA table_info(instance_configuration)`).all();
    const migratedTeamBlueName=!instanceColumns.results.some((column:any)=>column.name==="team_blue_name");
    if(migratedTeamBlueName) await d.prepare(`ALTER TABLE instance_configuration ADD COLUMN team_blue_name TEXT NOT NULL DEFAULT 'Azul'`).run();
    const migratedTeamYellowName=!instanceColumns.results.some((column:any)=>column.name==="team_yellow_name");
    if(migratedTeamYellowName) await d.prepare(`ALTER TABLE instance_configuration ADD COLUMN team_yellow_name TEXT NOT NULL DEFAULT 'Amarelo'`).run();
    const migratedManualSeparationEnabled=!instanceColumns.results.some((column:any)=>column.name==="manual_separation_enabled");
    if(migratedManualSeparationEnabled) await d.prepare(`ALTER TABLE instance_configuration ADD COLUMN manual_separation_enabled INTEGER NOT NULL DEFAULT 0`).run();
    const careerColumns=await d.prepare(`PRAGMA table_info(career_configuration)`).all();
    const migratedMomentumMultiplier=!careerColumns.results.some((column:any)=>column.name==="momentum_multiplier");
    if(migratedMomentumMultiplier) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN momentum_multiplier REAL NOT NULL DEFAULT 1`).run();
    const migratedResultMomentumMultiplier=!careerColumns.results.some((column:any)=>column.name==="result_momentum_multiplier");
    if(migratedResultMomentumMultiplier) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN result_momentum_multiplier REAL NOT NULL DEFAULT 1`).run();
    const migratedTrackContributions=!careerColumns.results.some((column:any)=>column.name==="track_contributions");
    if(migratedTrackContributions) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN track_contributions INTEGER NOT NULL DEFAULT 1`).run();
    const migratedCardTiers=!careerColumns.results.some((column:any)=>column.name==="card_tiers_enabled");
    if(migratedCardTiers) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN card_tiers_enabled INTEGER NOT NULL DEFAULT 0`).run();
    const migratedCardBronzeMax=!careerColumns.results.some((column:any)=>column.name==="card_bronze_max");
    if(migratedCardBronzeMax) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN card_bronze_max REAL NOT NULL DEFAULT 2.4`).run();
    const migratedCardSilverMax=!careerColumns.results.some((column:any)=>column.name==="card_silver_max");
    if(migratedCardSilverMax) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN card_silver_max REAL NOT NULL DEFAULT 3.9`).run();
    const migratedCardGoldMax=!careerColumns.results.some((column:any)=>column.name==="card_gold_max");
    if(migratedCardGoldMax) await d.prepare(`ALTER TABLE career_configuration ADD COLUMN card_gold_max REAL NOT NULL DEFAULT 4.5`).run();
    const contributionColumns=await d.prepare(`PRAGMA table_info(career_match_contributions)`).all();
    const migratedOwnGoal=!contributionColumns.results.some((column:any)=>column.name==="is_own_goal");
    if(migratedOwnGoal) await d.prepare(`ALTER TABLE career_match_contributions ADD COLUMN is_own_goal INTEGER NOT NULL DEFAULT 0`).run();
    const separationColumns=await d.prepare(`PRAGMA table_info(team_separations)`).all();
    const migratedArrivalOrder=!separationColumns.results.some((column:any)=>column.name==="arrival_order");
    if(migratedArrivalOrder) await d.prepare(`ALTER TABLE team_separations ADD COLUMN arrival_order TEXT`).run();
    const migratedMatchDraft=!separationColumns.results.some((column:any)=>column.name==="match_draft");
    if(migratedMatchDraft) await d.prepare(`ALTER TABLE team_separations ADD COLUMN match_draft TEXT`).run();
    const voteColumns=await d.prepare(`PRAGMA table_info(career_votes)`).all();
    const migratedVoteAccountType=!voteColumns.results.some((column:any)=>column.name==="voter_account_type");
    if(migratedVoteAccountType) await d.prepare(`ALTER TABLE career_votes ADD COLUMN voter_account_type TEXT`).run();
    const migratedVoteAccountId=!voteColumns.results.some((column:any)=>column.name==="voter_account_id");
    if(migratedVoteAccountId) await d.prepare(`ALTER TABLE career_votes ADD COLUMN voter_account_id TEXT`).run();
    await d.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS career_votes_account_unique_idx ON career_votes(career_match_id,voter_account_type,voter_account_id) WHERE voter_account_type IS NOT NULL AND voter_account_id IS NOT NULL`).run();
    const notificationColumns=await d.prepare(`PRAGMA table_info(account_notifications)`).all();
    const migratedNotificationActionUrl=!notificationColumns.results.some((column:any)=>column.name==="action_url");
    if(migratedNotificationActionUrl) await d.prepare(`ALTER TABLE account_notifications ADD COLUMN action_url TEXT`).run();
    const preferenceColumns=await d.prepare(`PRAGMA table_info(account_notification_preferences)`).all();
    const migratedAppUpdatesInApp=!preferenceColumns.results.some((column:any)=>column.name==="app_updates_in_app");
    if(migratedAppUpdatesInApp) await d.prepare(`ALTER TABLE account_notification_preferences ADD COLUMN app_updates_in_app INTEGER NOT NULL DEFAULT 1`).run();
    const migratedAppUpdatesPush=!preferenceColumns.results.some((column:any)=>column.name==="app_updates_push");
    if(migratedAppUpdatesPush) await d.prepare(`ALTER TABLE account_notification_preferences ADD COLUMN app_updates_push INTEGER NOT NULL DEFAULT 1`).run();
    const now=new Date().toISOString();
    await d.prepare(`INSERT OR IGNORE INTO player_account_links (player_id,account_type,account_id,created_at) SELECT player_id,'member',id,? FROM member_accounts WHERE player_id IS NOT NULL`).bind(now).run();
    await d.prepare(`UPDATE member_accounts SET player_id=NULL WHERE player_id IS NOT NULL`).run();
    await d.prepare(`INSERT OR IGNORE INTO system_configuration (id,default_player_count,minimum_recommended_players,maximum_recommended_players,speed_weight,skill_weight,marking_weight,maximum_position_difference,protected_top_players_percentage,default_reserve_count,algorithm_attempts,updated_at) VALUES (1,22,14,30,.48,.32,.2,1,.25,0,2500,?)`).bind(now).run();
    await d.prepare(`INSERT OR IGNORE INTO instance_configuration (id,updated_at) VALUES (1,?)`).bind(now).run();
    await d.prepare(`INSERT OR IGNORE INTO career_configuration (id,enabled,winner_bonus,loser_penalty,motm_third,motm_second,motm_first,dotm_third,dotm_second,dotm_first,voting_days,updated_at) VALUES (1,1,.1,-.1,.1,.2,.3,-.1,-.2,-.3,5,?)`).bind(now).run();
    await d.prepare(`INSERT OR IGNORE INTO mobile_release_configuration (id,latest_version,android_build,ios_build,minimum_android_build,minimum_ios_build,android_enabled,ios_enabled,android_url,release_notes,updated_at) VALUES (1,'1.0.0',1,1,1,1,0,0,'https://web.vegaalameda.com/download/pedemaisuma/android/PeladaPedeMaisUma.apk','',?)`).bind(now).run();
    await seed(d,now);
    logEvent("info","database_ready",{migratedPlayerMarking,migratedPlayerMomentum,migratedResultMomentum,migratedVotingMomentum,migratedGoalkeeperPositioning,migratedGoalExit,migratedMarkingWeight,migratedTeamBlueName,migratedTeamYellowName,migratedManualSeparationEnabled,migratedMomentumMultiplier,migratedResultMomentumMultiplier,migratedTrackContributions,migratedCardTiers,migratedCardBronzeMax,migratedCardSilverMax,migratedCardGoldMax,migratedOwnGoal,migratedArrivalOrder,migratedMatchDraft,migratedVoteAccountType,migratedVoteAccountId,migratedNotificationActionUrl,migratedAppUpdatesInApp,migratedAppUpdatesPush});
  })();
  return ready;
}
async function backfillMomentumSources(d:D1Database){
  const matches=await d.prepare(`SELECT results_snapshot FROM career_matches WHERE votes_momentum_applied=1 AND results_snapshot IS NOT NULL`).all();
  const players=await d.prepare(`SELECT id,momentum FROM players`).all();
  const separated=splitLegacyMomentumSources(players.results as any[],(matches.results as any[]).map(row=>row.results_snapshot));
  const statements=separated.map(row=>d.prepare(`UPDATE players SET result_momentum=?,voting_momentum=? WHERE id=?`).bind(row.resultMomentum,row.votingMomentum,row.id));
  for(let index=0;index<statements.length;index+=50)await d.batch(statements.slice(index,index+50));
  logEvent("info","momentum_sources_backfilled",{players:statements.length,matches:matches.results.length});
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
export async function currentAdmin(request:Request){await ensureDb();const token=(request.headers.get("cookie")||"").match(/ppm_session=([^;]+)/)?.[1];if(token)return db().prepare(`SELECT a.id,a.email,a.active,a.must_change_password mustChangePassword,a.created_at createdAt,l.player_id playerId,'administrator' accountType FROM sessions s JOIN administrators a ON a.id=s.administrator_id LEFT JOIN player_account_links l ON l.account_type='administrator' AND l.account_id=a.id WHERE s.id=? AND s.expires_at>? AND a.active=1`).bind(token,new Date().toISOString()).first();const mobile=await currentMobileAccount(request);return mobile?.accountType==="administrator"?mobile:null;}
export function adminRequired(request:Request){return currentAdmin(request)}
export async function currentMember(request:Request){await ensureDb();const token=(request.headers.get("cookie")||"").match(/ppm_member_session=([^;]+)/)?.[1];if(token)return db().prepare(`SELECT a.id,a.email,l.player_id playerId,a.created_at createdAt,'member' accountType FROM member_sessions s JOIN member_accounts a ON a.id=s.member_account_id LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id WHERE s.id=? AND s.expires_at>? AND a.active=1`).bind(token,new Date().toISOString()).first();const mobile=await currentMobileAccount(request);return mobile?.accountType==="member"?mobile:null;}
export function memberRequired(request:Request){return currentMember(request)}
export async function currentPlayerAccount(request:Request){return await currentAdmin(request) || await currentMember(request)}
export function playerAccountRequired(request:Request){return currentPlayerAccount(request)}
export async function audit(adminId:string|null,action:string,entityType:string,entityId?:string,newData?:unknown,previousData?:unknown){await db().prepare(`INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),adminId,action,entityType,entityId||null,previousData?JSON.stringify(previousData):null,newData?JSON.stringify(newData):null,new Date().toISOString()).run()}

async function currentMobileAccount(request:Request){
  const authorization=request.headers.get("authorization")||"",accessToken=authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!accessToken)return null;
  const hash=await hashOpaqueToken(accessToken),now=new Date().toISOString();
  const session:any=await db().prepare(`SELECT id,account_type,account_id FROM mobile_sessions WHERE access_token_hash=? AND access_expires_at>? AND refresh_expires_at>? AND revoked_at IS NULL`).bind(hash,now,now).first();
  if(!session)return null;
  await db().prepare(`UPDATE mobile_sessions SET last_used_at=? WHERE id=?`).bind(now,session.id).run();
  if(session.account_type==="administrator")return db().prepare(`SELECT a.id,a.email,a.active,a.must_change_password mustChangePassword,a.created_at createdAt,l.player_id playerId,'administrator' accountType,? mobileSessionId FROM administrators a LEFT JOIN player_account_links l ON l.account_type='administrator' AND l.account_id=a.id WHERE a.id=? AND a.active=1`).bind(session.id,session.account_id).first();
  return db().prepare(`SELECT a.id,a.email,l.player_id playerId,a.created_at createdAt,'member' accountType,? mobileSessionId FROM member_accounts a LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id WHERE a.id=? AND a.active=1`).bind(session.id,session.account_id).first();
}

export async function hashOpaqueToken(token:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return toHex(new Uint8Array(digest));}
