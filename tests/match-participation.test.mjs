import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, { createCareerMatch, editCareerMatch }, { buildParticipationSnapshot }, memberAuth, careerVote] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/career-service.ts"),
  import("../lib/match-participation.ts"),
  import("../app/api/member-auth/route.ts"),
  import("../app/api/career/vote/route.ts"),
]);

test("valida a revisão e preserva escalação, faltosos e inclusões tardias", () => {
  const lineup={blue:[{id:"p1",displayName:"Um"},{id:"p2",displayName:"Dois"}],yellow:[{id:"p3",displayName:"Três"},{id:"p4",displayName:"Quatro"}]};
  assert.throws(()=>buildParticipationSnapshot({input:{reviewed:false,blueIds:["p1"],yellowIds:["p3"]},lineup,players:[],administratorId:"admin",now:"2026-09-02T12:00:00.000Z"}),/Revise e confirme/);
  assert.throws(()=>buildParticipationSnapshot({input:{reviewed:true,blueIds:["p1","p2","p5"],yellowIds:["p3","p4","p6"]},lineup,players:[],administratorId:"admin",now:"2026-09-02T12:00:00.000Z"}),/pelo menos 7/);
  const participation=buildParticipationSnapshot({input:{reviewed:true,blueIds:["p1","p2","p5","p6"],yellowIds:["p3","p4","p7"]},lineup,players:[{id:"p5",display_name:"Cinco"},{id:"p6",display_name:"Seis"},{id:"p7",display_name:"Sete"}],administratorId:"admin",now:"2026-09-02T12:00:00.000Z"});
  assert.deepEqual(participation.lineupBlueIds,["p1","p2"]);
  assert.deepEqual(participation.blue.map(player=>player.id),["p1","p2","p5","p6"]);
});

test("aplica resultado somente aos participantes efetivos e recalcula uma correção", async () => {
  const directory=await mkdtemp(join(tmpdir(),"ppm-participation-")),bindings=await createSelfhostBindings(directory);
  setRuntimeBindings({...bindings,APP_BASE_URL:"https://pelada.example"});
  try {
    await ensureDb();
    await db().prepare("UPDATE career_configuration SET enabled=1,track_contributions=0,winner_bonus=.1,loser_penalty=-.1 WHERE id=1").run();
    const now=new Date().toISOString(),players=Array.from({length:8},(_,index)=>({id:`p${index+1}`,displayName:`Jogador ${index+1}`,primaryPosition:index===0?"Goleiro":"Ataque",type:index===0?"goalkeeper":"monthly"}));
    for(const player of players)await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(player.id,player.displayName,player.displayName,"[]",player.type,player.primaryPosition,3,3,3,3,3,1,now,now).run();
    const snapshot={blue:players.slice(0,4),yellow:players.slice(4,7)};
    await db().prepare(`INSERT INTO team_separations (id,match_title,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind("s-participation","Pelada", "",JSON.stringify(snapshot),0,"Bom equilíbrio",now,now,now).run();

    const match=await createCareerMatch("s-participation",2,1,"test-admin",[],{reviewed:true,blueIds:["p1","p2","p3","p8"],yellowIds:["p5","p6","p7"]});
    let values=(await db().prepare("SELECT id,result_momentum FROM players ORDER BY id").all()).results;
    const momentum=Object.fromEntries(values.map(row=>[row.id,Number(row.result_momentum)]));
    assert.equal(momentum.p4,0,"o escalado ausente não recebe vitória");
    assert.equal(momentum.p8,.1,"o participante incluído no fechamento recebe vitória");
    assert.equal(momentum.p5,-.1);
    assert.deepEqual(match.participation.blue.map(player=>player.id),["p1","p2","p3","p8"]);

    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind("member-p4","faltoso@example.com",await hashPassword("senha-segura-123"),1,now,now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind("p4","member","member-p4",now).run();
    const login=await memberAuth.POST(jsonRequest("https://pelada.example/api/member-auth",{email:"faltoso@example.com",password:"senha-segura-123"})),cookie=login.headers.get("set-cookie").split(";")[0];
    const voteState=await careerVote.GET(new Request(`https://pelada.example/api/career/vote?token=${match.votingToken}`,{headers:{cookie}})),votePayload=await voteState.json();
    assert.equal(voteState.status,200);
    assert.equal(votePayload.viewer.isParticipant,false);
    assert.equal(votePayload.viewer.canVote,false);
    const rejectedVote=await careerVote.POST(cookieJson("https://pelada.example/api/career/vote",cookie,{token:match.votingToken,motmThirdId:"p1",motmSecondId:"p2",motmFirstId:"p3",dotmThirdId:"p5",dotmSecondId:"p6",dotmFirstId:"p7"}));
    assert.equal(rejectedVote.status,400);
    assert.match((await rejectedVote.json()).error,/não participou/);

    await editCareerMatch(match.id,2,1,"test-admin",[],{reviewed:true,blueIds:["p1","p2","p3","p4"],yellowIds:["p5","p6","p7"]});
    values=(await db().prepare("SELECT id,result_momentum FROM players ORDER BY id").all()).results;
    const corrected=Object.fromEntries(values.map(row=>[row.id,Number(row.result_momentum)]));
    assert.equal(corrected.p4,.1,"a correção inclui o jogador no resultado");
    assert.equal(corrected.p8,0,"a correção estorna o resultado de quem foi removido");
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory,{recursive:true,force:true});
  }
});

function jsonRequest(url,body){return new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})}
function cookieJson(url,cookie,body){return new Request(url,{method:"POST",headers:{cookie,"content-type":"application/json"},body:JSON.stringify(body)})}
