export function updateWeightValue<T extends Record<string, unknown>>(current:T,key:string,next:number):T {
  const value=Math.max(0,Math.min(1,Math.round(next*100)/100));
  return {...current,[key]:value};
}

export function weightTotalPercent(current:Record<string, unknown>,keys:readonly string[]):number {
  return Math.round(keys.reduce((sum,key)=>sum+Number(current[key]??0),0)*100);
}
