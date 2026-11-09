import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, { createCareerMatch, editCareerMatch, removeAttendanceBonusFromLatestMatch }] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../lib/career-service.ts"),
]);

test("bônus especial é opcional por instância, usa voting_momentum e acompanha correções", async () => {
  const directory=await mkdtemp(join(tmpdir(),"ppm-attendance-bonus-")),bindings=await createSelfhostBindings(directory);
  setRuntimeBindings({...bindings,APP_BASE_URL:"https://pelada.example"});
  try {
    await ensureDb();
    await db().prepare(`UPDATE career_configuration SET track_contributions=0 WHERE id=1`).run();
    const now=new Date().toISOString(),players=Array.from({length:8},(_,index)=>({id:`p${index+1}`,displayName:`Jogador ${index+1}`,primaryPosition:index===0?"Goleiro":"Ataque",type:index===0?"goalkeeper":"monthly"}));
    for(const player of players)await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(player.id,player.displayName,player.displayName,"[]",player.type,player.primaryPosition,3,3,3,3,3,1,now,now).run();
    await db().prepare(`INSERT INTO team_separations (id,match_title,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind("s-bonus","Pelada com chuva","",JSON.stringify({blue:players.slice(0,4),yellow:players.slice(4,7)}),0,"Bom equilíbrio",now,now,now).run();
    const participation={reviewed:true,blueIds:["p1","p2","p3","p4"],yellowIds:["p5","p6","p7"]};
    await assert.rejects(()=>createCareerMatch("s-bonus",1,1,"admin",[],participation,{apply:true,reason:"Chuva e frio"}),/desativado/);
    await db().prepare(`UPDATE career_configuration SET attendance_bonus_enabled=1,attendance_bonus_default_value=.1 WHERE id=1`).run();
    const match=await createCareerMatch("s-bonus",1,1,"admin",[],participation,{apply:true,reason:"Chuva e frio"});
    assert.deepEqual(match.attendanceBonus,{value:.1,reason:"Chuva e frio",appliedAt:match.attendanceBonus.appliedAt});
    assert.equal(Number(await db().prepare(`SELECT voting_momentum FROM players WHERE id='p4'`).first("voting_momentum")),.1);
    assert.equal(Number(await db().prepare(`SELECT result_momentum FROM players WHERE id='p4'`).first("result_momentum")),0);
    await editCareerMatch(match.id,1,1,"admin",[],{reviewed:true,blueIds:["p1","p2","p3","p8"],yellowIds:["p5","p6","p7"]});
    assert.equal(Number(await db().prepare(`SELECT voting_momentum FROM players WHERE id='p4'`).first("voting_momentum")),0);
    assert.equal(Number(await db().prepare(`SELECT voting_momentum FROM players WHERE id='p8'`).first("voting_momentum")),.1);
    const tomorrow=new Date(Date.now()+86400000).toISOString();
    await db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind("next-match","Próxima pelada",tomorrow,tomorrow,"OPEN","admin",now,now).run();
    await assert.rejects(()=>removeAttendanceBonusFromLatestMatch(match.id,"admin"),/partida mais nova criada/);
    await db().prepare(`UPDATE scheduled_matches SET status='CANCELLED' WHERE id='next-match'`).run();
    const removed=await removeAttendanceBonusFromLatestMatch(match.id,"admin");
    assert.equal(removed.attendanceBonus,null);
    assert.equal(Number(await db().prepare(`SELECT voting_momentum FROM players WHERE id='p8'`).first("voting_momentum")),0);
  } finally { bindings.DB.close();setRuntimeBindings(undefined);await rm(directory,{recursive:true,force:true}); }
});
