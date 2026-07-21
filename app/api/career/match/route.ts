import { adminRequired } from "../../../../lib/database";
import { createCareerMatch, editCareerMatch } from "../../../../lib/career-service";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";

export async function POST(request:Request){
  const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});
  const payload=await request.json().catch(()=>({})) as any;
  try{const match=await createCareerMatch(String(payload.separationId||""),Number(payload.blueScore),Number(payload.yellowScore),admin.id,Array.isArray(payload.contributions)?payload.contributions:[]);const base=resolvePublicBaseUrl(request,getRuntimeBindings().APP_BASE_URL);return Response.json({match,votingUrl:`${base}/votacao?token=${encodeURIComponent(match?.votingToken||"")}`},{status:201});}
  catch(error:any){return Response.json({error:error.message||"Não foi possível confirmar a partida."},{status:400});}
}

export async function PUT(request:Request){
  const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});
  const payload=await request.json().catch(()=>({})) as any;
  try{const match=await editCareerMatch(String(payload.matchId||""),Number(payload.blueScore),Number(payload.yellowScore),admin.id,Array.isArray(payload.contributions)?payload.contributions:[]);return Response.json({match,message:"Resultado da partida atualizado."});}
  catch(error:any){return Response.json({error:error.message||"Não foi possível atualizar o resultado."},{status:400});}
}
