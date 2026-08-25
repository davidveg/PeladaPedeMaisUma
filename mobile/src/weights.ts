export type Weights = {
  speedWeight:number; skillWeight:number; markingWeight:number; tacticalIntelligenceWeight:number; competitivenessWeight:number;
  goalkeeperDefensesWeight:number; goalkeeperPositioningWeight:number; goalkeeperSafetyWeight:number; goalkeeperFootworkWeight:number; goalkeeperLeadershipWeight:number;
  ratingSystemVersion?:number; updatedAt?:string;
};
export const defaultWeights:Weights={speedWeight:.35,skillWeight:.25,markingWeight:.15,tacticalIntelligenceWeight:.2,competitivenessWeight:.05,goalkeeperDefensesWeight:.4,goalkeeperPositioningWeight:.25,goalkeeperSafetyWeight:.2,goalkeeperFootworkWeight:.1,goalkeeperLeadershipWeight:.05,ratingSystemVersion:2};
export const lineWeightKeys=["speedWeight","skillWeight","markingWeight","tacticalIntelligenceWeight","competitivenessWeight"] as const;
export const goalkeeperWeightKeys=["goalkeeperDefensesWeight","goalkeeperPositioningWeight","goalkeeperSafetyWeight","goalkeeperFootworkWeight","goalkeeperLeadershipWeight"] as const;
export type WeightKey=typeof lineWeightKeys[number]|typeof goalkeeperWeightKeys[number];
export function updateWeight(current:Weights,key:WeightKey,next:number):Weights{
  return {...current,[key]:Math.max(0,Math.min(1,Math.round(next*100)/100))};
}
export function weightTotalPercent(current:Weights,keys:readonly WeightKey[]):number{
  return Math.round(keys.reduce((sum,key)=>sum+Number(current[key]??0),0)*100);
}
