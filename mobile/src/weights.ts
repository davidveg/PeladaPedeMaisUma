export type Weights = {
  speedWeight:number; skillWeight:number; markingWeight:number; tacticalIntelligenceWeight:number; competitivenessWeight:number;
  goalkeeperDefensesWeight:number; goalkeeperPositioningWeight:number; goalkeeperSafetyWeight:number; goalkeeperFootworkWeight:number; goalkeeperLeadershipWeight:number;
  ratingSystemVersion?:number; updatedAt?:string;
};
export const defaultWeights:Weights={speedWeight:.35,skillWeight:.25,markingWeight:.15,tacticalIntelligenceWeight:.2,competitivenessWeight:.05,goalkeeperDefensesWeight:.4,goalkeeperPositioningWeight:.25,goalkeeperSafetyWeight:.2,goalkeeperFootworkWeight:.1,goalkeeperLeadershipWeight:.05,ratingSystemVersion:2};
export const lineWeightKeys=["speedWeight","skillWeight","markingWeight","tacticalIntelligenceWeight","competitivenessWeight"] as const;
export const goalkeeperWeightKeys=["goalkeeperDefensesWeight","goalkeeperPositioningWeight","goalkeeperSafetyWeight","goalkeeperFootworkWeight","goalkeeperLeadershipWeight"] as const;
export type WeightKey=typeof lineWeightKeys[number]|typeof goalkeeperWeightKeys[number];
export function normalizeWeights(current:Weights,keysOrChanged:readonly WeightKey[]|WeightKey,changedOrNext:WeightKey|number,maybeNext?:number):Weights{
  const grouped=Array.isArray(keysOrChanged),keys:readonly WeightKey[]=grouped?(keysOrChanged as readonly WeightKey[]):lineWeightKeys;
  const changed=(grouped?changedOrNext:keysOrChanged) as WeightKey,next=grouped?Number(maybeNext):Number(changedOrNext),result={...current};
  const bounded=Math.max(0,Math.min(1,round(next))),others=keys.filter(key=>key!==changed),remaining=1-bounded,total=others.reduce((sum,key)=>sum+Number(current[key]??0),0);
  result[changed]=bounded;
  let assigned=0;
  others.forEach((key,index)=>{const value=index===others.length-1?remaining-assigned:total>0?remaining*Number(current[key]??0)/total:remaining/others.length;result[key]=round(value);assigned+=result[key]});
  return result;
}
const round=(value:number)=>Math.round(value*10_000)/10_000;
