export type Position = "Defesa" | "Meio-campo" | "Ataque" | "Goleiro";
export type PlayerCareerStats = { games: number; wins: number; losses: number; goals?: number; assists?: number };
export type Player = { id: string; fullName: string; displayName: string; nickname?: string | null; aliases?: string[]; type: string; primaryPosition: Position; secondaryPosition?: Position | null; speed: number; skill: number; marking?: number; tacticalIntelligence?: number; competitiveness?: number; goalkeeperPositioning?: number; goalExit?: number; goalkeeperSafety?: number; goalkeeperLeadership?: number; momentum?: number; resultMomentum?: number; votingMomentum?: number; historicalPerformance?: { adjustment: number; confidence: number; games: number; recentMatches: number; [key: string]: number }; careerStats?: PlayerCareerStats; photoUrl?: string | null; notes?: string | null; active?: boolean };
export type Config = { speedWeight: number; skillWeight: number; markingWeight: number; tacticalIntelligenceWeight?: number; competitivenessWeight?: number; goalkeeperDefensesWeight?: number; goalkeeperPositioningWeight?: number; goalkeeperSafetyWeight?: number; goalkeeperFootworkWeight?: number; goalkeeperLeadershipWeight?: number; ratingSystemVersion?: number; resultMomentumMultiplier?: number; momentumMultiplier?: number; historicalLearningEnabled?: boolean; showContributions?: boolean; cardTiersEnabled?: boolean; cardBronzeMax?: number; cardSilverMax?: number; cardGoldMax?: number; maximumPositionDifference?: number; protectedTopPlayersPercentage: number; algorithmAttempts: number };

export const defaultConfig: Config = { speedWeight: .35, skillWeight: .25, markingWeight: .15, tacticalIntelligenceWeight: .2, competitivenessWeight: .05, goalkeeperDefensesWeight: .4, goalkeeperPositioningWeight: .25, goalkeeperSafetyWeight: .2, goalkeeperFootworkWeight: .1, goalkeeperLeadershipWeight: .05, ratingSystemVersion: 2, resultMomentumMultiplier: 1, momentumMultiplier: 1, historicalLearningEnabled: false, cardTiersEnabled: false, cardBronzeMax: 2.4, cardSilverMax: 3.9, cardGoldMax: 4.5, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };
export const BALANCE_ALGORITHM_VERSION = 1;
const modernRatingSystem = (c: Config) => c.ratingSystemVersion === 2 || c.tacticalIntelligenceWeight != null;
export const playerAttributes = (p: Player) => p.primaryPosition === "Goleiro" || p.type === "goalkeeper"
  ? { speed: p.goalkeeperPositioning ?? p.speed ?? 3, skill: p.skill, marking: p.goalExit ?? p.marking ?? 3, tacticalIntelligence: p.goalkeeperSafety ?? 3, competitiveness: p.goalkeeperLeadership ?? 3 }
  : { speed: p.speed, skill: p.skill, marking: p.marking ?? 3, tacticalIntelligence: p.tacticalIntelligence ?? 3, competitiveness: p.competitiveness ?? 3 };
export const momentumContribution = (p: Player, c: Config = defaultConfig) => {
  const hasSeparatedSources = p.resultMomentum != null || p.votingMomentum != null;
  if (!hasSeparatedSources) return (p.momentum ?? 0) * (c.momentumMultiplier ?? 1);
  return (p.resultMomentum ?? 0) * (c.resultMomentumMultiplier ?? 1) + (p.votingMomentum ?? 0) * (c.momentumMultiplier ?? 1);
};
export const score = (p: Player, c = defaultConfig) => {
  const attributes=playerAttributes(p);
  const goalkeeper=p.primaryPosition==="Goleiro"||p.type==="goalkeeper";
  const hasExpandedRatings=goalkeeper?(p.goalkeeperSafety!=null||p.goalkeeperLeadership!=null):(p.tacticalIntelligence!=null||p.competitiveness!=null);
  const base=modernRatingSystem(c)&&!hasExpandedRatings
    ? attributes.speed*.48+attributes.skill*.32+attributes.marking*.2
    : !modernRatingSystem(c)
    ? attributes.speed*c.speedWeight+attributes.skill*c.skillWeight+attributes.marking*c.markingWeight
    : goalkeeper
      ? attributes.skill*(c.goalkeeperDefensesWeight??.4)+attributes.speed*(c.goalkeeperPositioningWeight??.25)+attributes.tacticalIntelligence*(c.goalkeeperSafetyWeight??.2)+attributes.marking*(c.goalkeeperFootworkWeight??.1)+attributes.competitiveness*(c.goalkeeperLeadershipWeight??.05)
      : attributes.speed*c.speedWeight+attributes.skill*c.skillWeight+attributes.marking*c.markingWeight+attributes.tacticalIntelligence*(c.tacticalIntelligenceWeight??.2)+attributes.competitiveness*(c.competitivenessWeight??.05);
  const raw=base+momentumContribution(p,c);
  return Math.round(Math.max(1,Math.min(5,raw))*10)/10;
};
export const historicalLearningContribution = (p: Player, c: Config = defaultConfig) => c.historicalLearningEnabled ? Number(p.historicalPerformance?.adjustment ?? 0) : 0;
export const balancingScore = (p: Player, c: Config = defaultConfig) => Math.max(1, Math.min(5, score(p, c) + historicalLearningContribution(p, c)));
export const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f\u200B-\u200D\uFEFF]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
export type ImportedPlayerType = "monthly" | "guest" | "goalkeeper";

export function parseWhatsApp(text: string) {
  const clean = text.replace(/[\u200B-\u200D\uFEFF\uFE0E\uFE0F]/g, "");
  const lines = clean.split(/\r?\n/).map((raw, index) => ({ raw, index: index + 1 }));
  const first = lines.find(x => x.raw.trim())?.raw.trim() || "Pelada";
  const dateMatch = clean.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  let section: ImportedPlayerType = "monthly";
  const confirmed: string[] = [], absent: string[] = [], unrecognized: string[] = [];
  const typesByName: Record<string,ImportedPlayerType> = {};
  for (const line of lines) {
    const value = line.raw.trim();
    if (!value) continue;
    const normalized = normalizeName(value);
    if (/^goleiros?\b/.test(normalized)) { section = "goalkeeper"; continue; }
    if (/^mensalistas?\b/.test(normalized)) { section = "monthly"; continue; }
    if (/^convidados?\b/.test(normalized)) { section = "guest"; continue; }
    if (/nao vai comparecer|vai comparecer|em branco/.test(normalized)) continue;
    const match = value.match(/^\s*\d+\s*[-.)]?\s*(.+?)(?:\s*:\s*)?([✅❌]*)\s*$/u);
    if (!match) { if (line.index > 1 && value !== first) unrecognized.push(value); continue; }
    const name = match[1].replace(/\s*:\s*$/, "").trim();
    if (!name) continue;
    typesByName[normalizeName(name)] = section;
    if (value.includes("✅") || (section === "goalkeeper" && !value.includes("❌"))) confirmed.push(name);
    else absent.push(name);
  }
  const duplicates = confirmed.filter((n, i) => confirmed.findIndex(x => normalizeName(x) === normalizeName(n)) !== i);
  return { title: first.replace(/^\*|\*$/g,""), date: dateMatch ? `${dateMatch[3] || new Date().getFullYear()}-${dateMatch[2].padStart(2,"0")}-${dateMatch[1].padStart(2,"0")}` : "", confirmed, absent, unrecognized, duplicates, typesByName };
}

export function matchPlayers(names: string[], players: Player[]) {
  return names.map(name => {
    const n = normalizeName(name);
    const exact = players.filter(p => [p.displayName, ...(p.aliases || []), p.nickname || "", p.fullName].some(v => normalizeName(v) === n));
    if (exact.length === 1) return { name, status: "found" as const, player: exact[0] };
    if (exact.length > 1) return { name, status: "ambiguous" as const, suggestions: exact };
    const suggestions = players.filter(p => [p.displayName, p.nickname || "", ...(p.aliases || [])].some(v => normalizeName(v).startsWith(n) || n.startsWith(normalizeName(v)))).slice(0, 3);
    return { name, status: suggestions.length ? "ambiguous" as const : "missing" as const, suggestions };
  });
}

type PositionCounts = Record<Position, number>;
const emptyPositionCounts = (): PositionCounts => ({ Defesa: 0, "Meio-campo": 0, Ataque: 0, Goleiro: 0 });
const linePositionNames: Position[] = ["Defesa", "Meio-campo", "Ataque"];

export function resolveBalancedPositions(blue: Player[], yellow: Player[], maximumPositionDifference = 1) {
  const bluePositions = emptyPositionCounts(), yellowPositions = emptyPositionCounts();
  const flexible: { side: "blue" | "yellow"; primary: Position; secondary: Position; used: boolean }[] = [];
  for (const [side, team, positions] of [["blue", blue, bluePositions], ["yellow", yellow, yellowPositions]] as const) for (const player of team) {
    const goalkeeper = player.primaryPosition === "Goleiro" || player.type === "goalkeeper" || player.type === "casual";
    const primary = goalkeeper ? "Goleiro" : player.primaryPosition;
    positions[primary]++;
    if (!goalkeeper && player.secondaryPosition && linePositionNames.includes(player.secondaryPosition) && player.secondaryPosition !== primary) flexible.push({ side, primary, secondary: player.secondaryPosition, used: false });
  }
  const objective = () => {
    const differences = linePositionNames.map(position => Math.abs(bluePositions[position] - yellowPositions[position]));
    return { difference: differences.reduce((sum, value) => sum + value, 0), excess: differences.reduce((sum, value) => sum + Math.max(0, value - maximumPositionDifference), 0) };
  };
  let current = objective(), secondaryUses = 0;
  while (true) {
    let selected: number | null = null, selectedObjective = current;
    for (let index = 0; index < flexible.length; index++) {
      const option = flexible[index];
      if (option.used) continue;
      const positions = option.side === "blue" ? bluePositions : yellowPositions;
      positions[option.primary]--; positions[option.secondary]++;
      const candidate = objective();
      positions[option.secondary]--; positions[option.primary]++;
      if ((candidate.excess < selectedObjective.excess || (candidate.excess === selectedObjective.excess && candidate.difference < selectedObjective.difference))) {
        selected = index; selectedObjective = candidate;
      }
    }
    if (selected == null) break;
    const option = flexible[selected], positions = option.side === "blue" ? bluePositions : yellowPositions;
    positions[option.primary]--; positions[option.secondary]++; option.used = true; secondaryUses++; current = selectedObjective;
  }
  return { bluePositions, yellowPositions, secondaryUses, positionDifference: current.difference, positionExcess: current.excess };
}

export function calculateTeamMetrics(team: Player[], c: Config = defaultConfig, resolvedPositions?: PositionCounts) {
  const positions = resolvedPositions ?? emptyPositionCounts();
  if (!resolvedPositions) team.forEach(p => positions[p.primaryPosition]++);
  const guests = team.filter(isGuest).length;
  const speed = team.reduce((s,p)=>s+playerAttributes(p).speed,0), skill = team.reduce((s,p)=>s+playerAttributes(p).skill,0), marking = team.reduce((s,p)=>s+playerAttributes(p).marking,0), tacticalIntelligence=team.reduce((s,p)=>s+playerAttributes(p).tacticalIntelligence,0), competitiveness=team.reduce((s,p)=>s+playerAttributes(p).competitiveness,0),momentum=team.reduce((s,p)=>s+momentumContribution(p,c),0),historicalLearning=team.reduce((s,p)=>s+historicalLearningContribution(p,c),0),total = team.reduce((s,p)=>s+score(p,c),0),balancingTotal=total+historicalLearning;
  return { count: team.length, guests, positions, speed, skill, marking, tacticalIntelligence, competitiveness, momentum, historicalLearning, total, balancingTotal, speedAvg: speed/team.length||0, skillAvg: skill/team.length||0, markingAvg: marking/team.length||0, tacticalIntelligenceAvg:tacticalIntelligence/team.length||0, competitivenessAvg:competitiveness/team.length||0, momentumAvg:momentum/team.length||0, historicalLearningAvg:historicalLearning/team.length||0, scoreAvg: total/team.length||0, balancingScoreAvg:balancingTotal/team.length||0 };
}

export function calculateTeamDelta(blue: Player[], yellow: Player[], c: Config = defaultConfig) {
  const resolved = resolveBalancedPositions(blue, yellow, Number(c.maximumPositionDifference ?? defaultConfig.maximumPositionDifference));
  const blueMetrics = calculateTeamMetrics(blue, c, resolved.bluePositions), yellowMetrics = calculateTeamMetrics(yellow, c, resolved.yellowPositions);
  const advantage = (blueValue: number, yellowValue: number) => blueValue === yellowValue ? "EVEN" : blueValue > yellowValue ? "BLUE" : "YELLOW";
  const delta = {
    players: Math.abs(blueMetrics.count-yellowMetrics.count),
    guests: Math.abs(blueMetrics.guests-yellowMetrics.guests),
    defenders: Math.abs(blueMetrics.positions.Defesa-yellowMetrics.positions.Defesa),
    midfielders: Math.abs(blueMetrics.positions["Meio-campo"]-yellowMetrics.positions["Meio-campo"]),
    attackers: Math.abs(blueMetrics.positions.Ataque-yellowMetrics.positions.Ataque),
    speed: Math.abs(blueMetrics.speed-yellowMetrics.speed),
    skill: Math.abs(blueMetrics.skill-yellowMetrics.skill),
    marking: Math.abs(blueMetrics.marking-yellowMetrics.marking),
    tacticalIntelligence: Math.abs(blueMetrics.tacticalIntelligence-yellowMetrics.tacticalIntelligence),
    competitiveness: Math.abs(blueMetrics.competitiveness-yellowMetrics.competitiveness),
    momentum: Math.abs(blueMetrics.momentum-yellowMetrics.momentum),
    historicalLearning: Math.abs(blueMetrics.historicalLearning-yellowMetrics.historicalLearning),
    score: Math.abs(blueMetrics.total-yellowMetrics.total),
    balancingScore: Math.abs(blueMetrics.balancingTotal-yellowMetrics.balancingTotal),
    advantage: {
      players: advantage(blueMetrics.count, yellowMetrics.count),
      defenders: advantage(blueMetrics.positions.Defesa, yellowMetrics.positions.Defesa),
      midfielders: advantage(blueMetrics.positions["Meio-campo"], yellowMetrics.positions["Meio-campo"]),
      attackers: advantage(blueMetrics.positions.Ataque, yellowMetrics.positions.Ataque),
      speed: advantage(blueMetrics.speed, yellowMetrics.speed),
      skill: advantage(blueMetrics.skill, yellowMetrics.skill),
      marking: advantage(blueMetrics.marking, yellowMetrics.marking),
      tacticalIntelligence: advantage(blueMetrics.tacticalIntelligence, yellowMetrics.tacticalIntelligence),
      competitiveness: advantage(blueMetrics.competitiveness, yellowMetrics.competitiveness),
      momentum: advantage(blueMetrics.momentum, yellowMetrics.momentum),
      historicalLearning: advantage(blueMetrics.historicalLearning, yellowMetrics.historicalLearning),
      score: advantage(blueMetrics.total, yellowMetrics.total),
    },
  };
  return { blueMetrics, yellowMetrics, delta };
}

export function guestBalancePenalty(blue: Player[], yellow: Player[]) {
  const blueGuests = blue.filter(isGuest).length, yellowGuests = yellow.filter(isGuest).length;
  const totalGuests = blueGuests + yellowGuests;
  if (totalGuests < 2) return 0;
  const minimumDifference = totalGuests % 2;
  return Math.max(0, Math.abs(blueGuests-yellowGuests)-minimumDifference) * 2500;
}

function teamBalanceCost(blue:Player[],yellow:Player[],config:Config,maximumPositionDifference:number){
  const resolved=resolveBalancedPositions(blue,yellow,maximumPositionDifference),bm=calculateTeamMetrics(blue,config,resolved.bluePositions),ym=calculateTeamMetrics(yellow,config,resolved.yellowPositions);
  const positionDiff=resolved.positionDifference,positionExcess=resolved.positionExcess;
  const attributeDifference=Math.abs(bm.total-bm.momentum-ym.total+ym.momentum);
  return Math.abs(blue.length-yellow.length)*1000+positionExcess*2000+positionDiff*120+guestBalancePenalty(blue,yellow)+attributeDifference*14+Math.abs(bm.scoreAvg-ym.scoreAvg)*18+Math.abs(bm.historicalLearning-ym.historicalLearning)*30;
}

function additionalPlayerCandidates(players:Player[],protectedIds:Set<string>){
  const groups=[
    players.filter(player=>player.primaryPosition!=="Goleiro"&&!protectedIds.has(player.id)),
    players.filter(player=>player.primaryPosition!=="Goleiro"),
    players.filter(player=>!protectedIds.has(player.id)),
    players,
  ];
  return groups.find(group=>group.length)??[];
}

function protectedPlayerIds(players:Player[],config:Config){
  const line=players.filter(player=>player.primaryPosition!=="Goleiro"),configuredPercentage=Number(config.protectedTopPlayersPercentage);
  const percentage=Number.isFinite(configuredPercentage)?Math.min(1,Math.max(0,configuredPercentage)):defaultConfig.protectedTopPlayersPercentage;
  const protectedPerTeam=Math.min(Math.floor(line.length/2),Math.ceil(line.length*percentage/2));
  return new Set([...line].sort((a,b)=>balancingScore(b,config)-balancingScore(a,config)).slice(0,protectedPerTeam*2).map(player=>player.id));
}

function evaluateTeamSplit(blue:Player[],yellow:Player[],config:Config,maximumPositionDifference:number,protectedIds:Set<string>){
  if((blue.length+yellow.length)%2===0||Math.abs(blue.length-yellow.length)!==1)return{cost:teamBalanceCost(blue,yellow,config,maximumPositionDifference),extraId:undefined as string|undefined,blueBase:blue,yellowBase:yellow};
  const largerKey=blue.length>yellow.length?"blue":"yellow",larger=largerKey==="blue"?blue:yellow;
  let best:{cost:number;extraId:string;extraScore:number;blueBase:Player[];yellowBase:Player[]}|null=null;
  for(const candidate of additionalPlayerCandidates(larger,protectedIds)){
    const blueBase=largerKey==="blue"?blue.filter(player=>player.id!==candidate.id):blue;
    const yellowBase=largerKey==="yellow"?yellow.filter(player=>player.id!==candidate.id):yellow;
    const cost=teamBalanceCost(blueBase,yellowBase,config,maximumPositionDifference);
    const extraScore=balancingScore(candidate,config);
    if(!best||cost<best.cost||(cost===best.cost&&extraScore<best.extraScore))best={cost,extraId:candidate.id,extraScore,blueBase,yellowBase};
  }
  return best??{cost:teamBalanceCost(blue,yellow,config,maximumPositionDifference),extraId:undefined,blueBase:blue,yellowBase:yellow};
}

function teamComparison(blue:Player[],yellow:Player[],config:Config,extraId?:string){
  const actual=calculateTeamDelta(blue,yellow,config),blueBase=extraId?blue.filter(player=>player.id!==extraId):blue,yellowBase=extraId?yellow.filter(player=>player.id!==extraId):yellow;
  if(!extraId)return{...actual,blueBaseMetrics:undefined,yellowBaseMetrics:undefined};
  const base=calculateTeamDelta(blueBase,yellowBase,config);
  return{
    blueMetrics:actual.blueMetrics,yellowMetrics:actual.yellowMetrics,
    blueBaseMetrics:base.blueMetrics,yellowBaseMetrics:base.yellowMetrics,
    delta:{...base.delta,players:actual.delta.players,baseTeams:true,advantage:{...base.delta.advantage,players:actual.delta.advantage.players}},
  };
}

export function recalculateTeamBalance(blue:Player[],yellow:Player[],config:Config=defaultConfig){
  const maximumPositionDifference=Number.isFinite(config.maximumPositionDifference)?Number(config.maximumPositionDifference):defaultConfig.maximumPositionDifference!;
  const evaluated=evaluateTeamSplit(blue,yellow,config,maximumPositionDifference,protectedPlayerIds([...blue,...yellow],config)),metrics=teamComparison(blue,yellow,config,evaluated.extraId);
  const rating=evaluated.cost<35?"Excelente equilíbrio":evaluated.cost<80?"Bom equilíbrio":evaluated.cost<150?"Equilíbrio aceitável":"Equilíbrio limitado";
  return{...metrics,cost:evaluated.cost,rating,extraId:evaluated.extraId,balanceAlgorithmVersion:BALANCE_ALGORITHM_VERSION};
}

export function balanceTeams(input: Player[], config = defaultConfig, nonce = 0) {
  if (input.length < 4) throw new Error("São necessários pelo menos 4 jogadores.");
  const maximumPositionDifference = Number.isFinite(config.maximumPositionDifference) ? Number(config.maximumPositionDifference) : defaultConfig.maximumPositionDifference!;
  const goalkeepers = input.filter(p=>p.primaryPosition === "Goleiro"), line = input.filter(p=>p.primaryPosition !== "Goleiro");
  const shouldBalanceGuests=input.filter(isGuest).length>=2;
  let best: { blue: Player[]; yellow: Player[]; cost: number; extraId?: string } | null = null;
  const configuredProtectedPercentage=Number(config.protectedTopPlayersPercentage),protectedTopPlayersPercentage=Number.isFinite(configuredProtectedPercentage)?Math.min(1,Math.max(0,configuredProtectedPercentage)):defaultConfig.protectedTopPlayersPercentage;
  const protectedPerTeam = Math.min(Math.floor(line.length/2), Math.ceil(line.length * protectedTopPlayersPercentage / 2));
  const protectedPlayers = [...line].sort((a,b)=>balancingScore(b,config)-balancingScore(a,config)).slice(0,protectedPerTeam*2);
  const protectedIds = new Set(protectedPlayers.map(p=>p.id));
  const remainingPlayers = line.filter(player=>!protectedIds.has(player.id));
  for (let attempt=0; attempt<Math.max(300, config.algorithmAttempts); attempt++) {
    const blue: Player[] = [], yellow: Player[] = [];
    for(let pairIndex=0;pairIndex<protectedPlayers.length;pairIndex+=2){
      const first=protectedPlayers[pairIndex],second=protectedPlayers[pairIndex+1];
      const randomInvert=Math.sin((attempt+1)*(pairIndex+1)*12.9898+(nonce+1)*78.233)<0;
      const regularGuestDifference=Math.abs(blue.filter(isGuest).length+Number(isGuest(first))-yellow.filter(isGuest).length-Number(isGuest(second)));
      const invertedGuestDifference=Math.abs(blue.filter(isGuest).length+Number(isGuest(second))-yellow.filter(isGuest).length-Number(isGuest(first)));
      const invert=!shouldBalanceGuests||invertedGuestDifference===regularGuestDifference?randomInvert:invertedGuestDifference<regularGuestDifference;
      (invert?yellow:blue).push(first);
      (invert?blue:yellow).push(second);
    }
    const shuffled = [...remainingPlayers].sort((a,b)=>Math.sin((attempt+1)*(playerSeed(a.id)+nonce+17)) - Math.sin((attempt+1)*(playerSeed(b.id)+nonce+17)));
    if(shouldBalanceGuests){
      const remainingGuests=shuffled.filter(isGuest),remainingRegulars=shuffled.filter(player=>!isGuest(player));
      remainingGuests.forEach(player=>{
        const blueGuestCount=blue.filter(isGuest).length,yellowGuestCount=yellow.filter(isGuest).length;
        if(blueGuestCount===yellowGuestCount)(blue.length<=yellow.length?blue:yellow).push(player);
        else (blueGuestCount<yellowGuestCount?blue:yellow).push(player);
      });
      remainingRegulars.forEach(player=>(blue.length<=yellow.length?blue:yellow).push(player));
    }else shuffled.forEach(player=>(blue.length<=yellow.length?blue:yellow).push(player));
    if (goalkeepers[0]) blue.push(goalkeepers[0]); if (goalkeepers[1]) yellow.push(goalkeepers[1]); goalkeepers.slice(2).forEach((p,i)=>(i%2?yellow:blue).push(p));
    const evaluated=evaluateTeamSplit(blue,yellow,config,maximumPositionDifference,protectedIds);
    if (!best || evaluated.cost < best.cost) best={blue,yellow,cost:evaluated.cost,extraId:evaluated.extraId};
  }
  const {blueMetrics,yellowMetrics,blueBaseMetrics,yellowBaseMetrics,delta}=teamComparison(best!.blue,best!.yellow,config,best!.extraId);
  const rating = best!.cost < 35 ? "Excelente equilíbrio" : best!.cost < 80 ? "Bom equilíbrio" : best!.cost < 150 ? "Equilíbrio aceitável" : "Equilíbrio limitado";
  return { ...best!, blueMetrics, yellowMetrics, blueBaseMetrics, yellowBaseMetrics, delta, rating, proposal: nonce+1, speedWeight: config.speedWeight, skillWeight: config.skillWeight, markingWeight: config.markingWeight, tacticalIntelligenceWeight:config.tacticalIntelligenceWeight, competitivenessWeight:config.competitivenessWeight, goalkeeperDefensesWeight:config.goalkeeperDefensesWeight, goalkeeperPositioningWeight:config.goalkeeperPositioningWeight, goalkeeperFootworkWeight:config.goalkeeperFootworkWeight, goalkeeperSafetyWeight:config.goalkeeperSafetyWeight, goalkeeperLeadershipWeight:config.goalkeeperLeadershipWeight, ratingSystemVersion:2, balanceAlgorithmVersion:BALANCE_ALGORITHM_VERSION, resultMomentumMultiplier: config.resultMomentumMultiplier??1, momentumMultiplier: config.momentumMultiplier??1, historicalLearningEnabled:Boolean(config.historicalLearningEnabled), maximumPositionDifference, protectedTopPlayersPercentage, algorithmAttempts: config.algorithmAttempts };
}

function playerSeed(id:string){return [...id].reduce((seed,character,index)=>seed+character.charCodeAt(0)*(index+1),0)}
function isGuest(player:Player){return player.type==="guest"}
