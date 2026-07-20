export type Position = "Defesa" | "Meio-campo" | "Ataque" | "Goleiro";
export type PlayerCareerStats = { games: number; wins: number; losses: number; goals?: number; assists?: number };
export type Player = { id: string; fullName: string; displayName: string; nickname?: string | null; aliases?: string[]; type: string; primaryPosition: Position; speed: number; skill: number; marking?: number; goalkeeperPositioning?: number; goalExit?: number; momentum?: number; careerStats?: PlayerCareerStats; photoUrl?: string | null; notes?: string | null; active?: boolean };
export type Config = { speedWeight: number; skillWeight: number; markingWeight: number; momentumMultiplier?: number; showContributions?: boolean; cardTiersEnabled?: boolean; cardBronzeMax?: number; cardSilverMax?: number; cardGoldMax?: number; maximumPositionDifference?: number; protectedTopPlayersPercentage: number; algorithmAttempts: number };

export const defaultConfig: Config = { speedWeight: .48, skillWeight: .32, markingWeight: .2, momentumMultiplier: 1, cardTiersEnabled: false, cardBronzeMax: 2.4, cardSilverMax: 3.9, cardGoldMax: 4.5, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };
export const playerAttributes = (p: Player) => p.primaryPosition === "Goleiro" || p.type === "goalkeeper"
  ? { speed: p.goalkeeperPositioning ?? p.speed ?? 3, skill: p.skill, marking: p.goalExit ?? p.marking ?? 3 }
  : { speed: p.speed, skill: p.skill, marking: p.marking ?? 3 };
export const score = (p: Player, c = defaultConfig) => {
  const attributes=playerAttributes(p);
  const raw=attributes.speed*c.speedWeight+attributes.skill*c.skillWeight+attributes.marking*c.markingWeight+(p.momentum??0)*(c.momentumMultiplier??1);
  return Math.round(Math.max(1,Math.min(5,raw))*10)/10;
};
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

export function calculateTeamMetrics(team: Player[], c: Config = defaultConfig) {
  const positions = { Defesa: 0, "Meio-campo": 0, Ataque: 0, Goleiro: 0 };
  team.forEach(p => positions[p.primaryPosition]++);
  const speed = team.reduce((s,p)=>s+playerAttributes(p).speed,0), skill = team.reduce((s,p)=>s+playerAttributes(p).skill,0), marking = team.reduce((s,p)=>s+playerAttributes(p).marking,0),momentum=team.reduce((s,p)=>s+(p.momentum??0),0), total = team.reduce((s,p)=>s+score(p,c),0);
  return { count: team.length, positions, speed, skill, marking, momentum, total, speedAvg: speed/team.length||0, skillAvg: skill/team.length||0, markingAvg: marking/team.length||0, momentumAvg:momentum/team.length||0, scoreAvg: total/team.length||0 };
}

export function calculateTeamDelta(blue: Player[], yellow: Player[], c: Config = defaultConfig) {
  const blueMetrics = calculateTeamMetrics(blue, c), yellowMetrics = calculateTeamMetrics(yellow, c);
  const delta = {
    players: Math.abs(blueMetrics.count-yellowMetrics.count),
    defenders: Math.abs(blueMetrics.positions.Defesa-yellowMetrics.positions.Defesa),
    midfielders: Math.abs(blueMetrics.positions["Meio-campo"]-yellowMetrics.positions["Meio-campo"]),
    attackers: Math.abs(blueMetrics.positions.Ataque-yellowMetrics.positions.Ataque),
    speed: Math.abs(blueMetrics.speed-yellowMetrics.speed),
    skill: Math.abs(blueMetrics.skill-yellowMetrics.skill),
    marking: Math.abs(blueMetrics.marking-yellowMetrics.marking),
    momentum: Math.abs(blueMetrics.momentum-yellowMetrics.momentum),
    score: Math.abs(blueMetrics.total-yellowMetrics.total),
  };
  return { blueMetrics, yellowMetrics, delta };
}

export function balanceTeams(input: Player[], config = defaultConfig, nonce = 0) {
  if (input.length < 4) throw new Error("São necessários pelo menos 4 jogadores.");
  const maximumPositionDifference = Number.isFinite(config.maximumPositionDifference) ? Number(config.maximumPositionDifference) : defaultConfig.maximumPositionDifference!;
  const goalkeepers = input.filter(p=>p.primaryPosition === "Goleiro"), line = input.filter(p=>p.primaryPosition !== "Goleiro");
  let best: { blue: Player[]; yellow: Player[]; cost: number; extraId?: string } | null = null;
  const protectedCount = Math.ceil(line.length * config.protectedTopPlayersPercentage);
  const protectedIds = new Set([...line].sort((a,b)=>score(b,config)-score(a,config)).slice(0,protectedCount).map(p=>p.id));
  for (let attempt=0; attempt<Math.max(300, config.algorithmAttempts); attempt++) {
    const shuffled = [...line].sort((a,b)=>Math.sin((attempt+1)*(a.id.charCodeAt(0)+nonce+17)) - Math.sin((attempt+1)*(b.id.charCodeAt(0)+nonce+17)));
    const blue: Player[] = [], yellow: Player[] = [];
    shuffled.forEach(p => (blue.length <= yellow.length ? blue : yellow).push(p));
    if (goalkeepers[0]) blue.push(goalkeepers[0]); if (goalkeepers[1]) yellow.push(goalkeepers[1]); goalkeepers.slice(2).forEach((p,i)=>(i%2?yellow:blue).push(p));
    const bm=calculateTeamMetrics(blue,config), ym=calculateTeamMetrics(yellow,config); const positionDifferences = ["Defesa","Meio-campo","Ataque"].map(k=>Math.abs(bm.positions[k as keyof typeof bm.positions]-ym.positions[k as keyof typeof ym.positions])),positionDiff=positionDifferences.reduce((sum,value)=>sum+value,0),positionExcess=positionDifferences.reduce((sum,value)=>sum+Math.max(0,value-maximumPositionDifference),0);
    const larger = blue.length>yellow.length?blue:yellow; const extra = input.length%2 ? [...larger].sort((a,b)=>score(a,config)-score(b,config)).find(p=>!protectedIds.has(p.id) && p.primaryPosition!=="Goleiro") : undefined;
    const attributeDifference = Math.abs(bm.speed-ym.speed)*config.speedWeight + Math.abs(bm.skill-ym.skill)*config.skillWeight + Math.abs(bm.marking-ym.marking)*config.markingWeight;
    const cost = Math.abs(blue.length-yellow.length)*1000 + positionExcess*2000 + positionDiff*120 + attributeDifference*14 + Math.abs(bm.scoreAvg-ym.scoreAvg)*18 + (input.length%2 && !extra ? 500 : 0);
    if (!best || cost < best.cost) best={blue,yellow,cost,extraId:extra?.id};
  }
  const { blueMetrics, yellowMetrics, delta }=calculateTeamDelta(best!.blue,best!.yellow,config);
  const rating = best!.cost < 35 ? "Excelente equilíbrio" : best!.cost < 80 ? "Bom equilíbrio" : best!.cost < 150 ? "Equilíbrio aceitável" : "Equilíbrio limitado";
  return { ...best!, blueMetrics, yellowMetrics, delta, rating, proposal: nonce+1, speedWeight: config.speedWeight, skillWeight: config.skillWeight, markingWeight: config.markingWeight, momentumMultiplier: config.momentumMultiplier??1, maximumPositionDifference, protectedTopPlayersPercentage: config.protectedTopPlayersPercentage, algorithmAttempts: config.algorithmAttempts };
}
