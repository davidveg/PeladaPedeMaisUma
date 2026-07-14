import { adminRequired } from "../../../../lib/database";
import { createCareerMatch } from "../../../../lib/career-service";

export async function POST(request:Request){
  const admin:any=await adminRequired(request);if(!admin)return Response.json({error:"Não autorizado"},{status:401});
  const payload=await request.json().catch(()=>({})) as any;
  try{const match=await createCareerMatch(String(payload.separationId||""),Number(payload.blueScore),Number(payload.yellowScore),admin.id);return Response.json({match,votingUrl:`/votacao?token=${match?.votingToken}`},{status:201});}
  catch(error:any){return Response.json({error:error.message||"Não foi possível confirmar a partida."},{status:400});}
}
