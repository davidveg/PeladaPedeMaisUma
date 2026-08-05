import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

test("migração preserva notas antigas e inicializa as novas disciplinas com nota 3",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"pelada-disciplines-")),bindings=await createSelfhostBindings(directory);
 try{
  await bindings.DB.exec(`CREATE TABLE players (id TEXT PRIMARY KEY,speed REAL NOT NULL,skill REAL NOT NULL,marking REAL NOT NULL,goalkeeper_positioning REAL NOT NULL,goal_exit REAL NOT NULL);INSERT INTO players VALUES ('p1',4.5,4,3.5,3,3);CREATE TABLE system_configuration (id INTEGER PRIMARY KEY,speed_weight REAL NOT NULL,skill_weight REAL NOT NULL,marking_weight REAL NOT NULL);INSERT INTO system_configuration VALUES (1,.48,.32,.2);`);
  await bindings.DB.exec(await readFile(new URL("../drizzle/0027_expanded_player_disciplines.sql",import.meta.url),"utf8"));
  const player=await bindings.DB.prepare(`SELECT * FROM players WHERE id='p1'`).first(),config=await bindings.DB.prepare(`SELECT * FROM system_configuration WHERE id=1`).first();
  assert.equal(player.speed,4.5);assert.equal(player.skill,4);assert.equal(player.marking,3.5);assert.equal(player.tactical_intelligence,3);assert.equal(player.competitiveness,3);assert.equal(player.goalkeeper_safety,3);assert.equal(player.goalkeeper_leadership,3);
  assert.deepEqual([config.speed_weight,config.skill_weight,config.marking_weight,config.tactical_intelligence_weight,config.competitiveness_weight],[.35,.25,.15,.2,.05]);
  assert.deepEqual([config.goalkeeper_defenses_weight,config.goalkeeper_positioning_weight,config.goalkeeper_safety_weight,config.goalkeeper_footwork_weight,config.goalkeeper_leadership_weight],[.4,.25,.2,.1,.05]);
 }finally{bindings.DB.close();await rm(directory,{recursive:true,force:true})}
});
