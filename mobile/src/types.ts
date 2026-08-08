export type Role = "admin" | "player";
export type Account = { id: string; email: string; role: Role; playerId: string | null };
export type Session = { account: Account; accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string };
export type CareerStats = { games: number; wins: number; losses: number; goals?: number; assists?: number };
export type Player = { id: string; displayName: string; fullName?: string; nickname?: string | null; aliases?: string[]; type: string; primaryPosition: string; speed: number; skill: number; marking?: number; tacticalIntelligence?:number; competitiveness?:number; goalkeeperPositioning?: number; goalExit?: number; goalkeeperSafety?:number; goalkeeperLeadership?:number; momentum?: number; resultMomentum?: number; votingMomentum?: number; photoUrl?: string | null; notes?: string | null; careerStats?: CareerStats };
export type Contribution = { team: "BLUE" | "YELLOW"; scorerPlayerId: string; assistPlayerId?: string | null; ownGoal?: boolean; scorerName?: string; assistName?: string | null };
export type CareerResultEntry = { playerId: string; place: number; points: number; firstVotes: number; secondVotes: number; thirdVotes: number; momentum: number };
export type CareerVotingResults = { voteCount: number; motm: CareerResultEntry[]; dotm: CareerResultEntry[] };
export type TeamMetrics = { count: number; positions: { Defesa: number; "Meio-campo": number; Ataque: number; Goleiro: number }; speed: number; skill: number; marking: number; tacticalIntelligence:number; competitiveness:number; momentum: number; total: number; speedAvg: number; skillAvg: number; markingAvg: number; tacticalIntelligenceAvg:number; competitivenessAvg:number; momentumAvg: number; scoreAvg: number };
export type TeamDelta = { players: number; defenders: number; midfielders: number; attackers: number; speed: number; skill: number; marking: number; tacticalIntelligence:number; competitiveness:number; momentum: number; score: number };
export type TeamResult = { blue: Player[]; yellow: Player[]; rating: string; cost: number; blueMetrics?: TeamMetrics; yellowMetrics?: TeamMetrics; delta?: TeamDelta; speedWeight: number; skillWeight: number; markingWeight: number; tacticalIntelligenceWeight?:number; competitivenessWeight?:number; goalkeeperDefensesWeight?:number; goalkeeperPositioningWeight?:number; goalkeeperSafetyWeight?:number; goalkeeperFootworkWeight?:number; goalkeeperLeadershipWeight?:number; ratingSystemVersion?:number; resultMomentumMultiplier?: number; momentumMultiplier?: number; maximumPositionDifference?: number; protectedTopPlayersPercentage?: number; algorithmAttempts?: number; proposal?: number; extraId?: string; [key: string]: unknown };
export type Separation = { id: string; matchTitle: string; matchDate?: string | null; location?: string | null; snapshot: TeamResult; balanceClassification: string; balanceScore: number; confirmedAt: string; arrivalOrder?: { blue: string[]; yellow: string[] } | null; career?: { id: string; blueScore: number; yellowScore: number; votingToken: string; votingUrl?: string; status: string; closesAt: string; closedAt?: string | null; results?: CareerVotingResults | null; contributions?: Contribution[]; viewerIsParticipant?: boolean; viewerHasVoted?: boolean; viewerCanVote?: boolean } };
export type ProfilePayload = { member: { id: string; email: string; accountType: "administrator" | "member"; playerId?: string | null }; player: Player | null; config?: { speedWeight:number;skillWeight:number;markingWeight:number;tacticalIntelligenceWeight:number;competitivenessWeight:number;goalkeeperDefensesWeight:number;goalkeeperPositioningWeight:number;goalkeeperSafetyWeight:number;goalkeeperFootworkWeight:number;goalkeeperLeadershipWeight:number;ratingSystemVersion?:number;resultMomentumMultiplier:number;momentumMultiplier:number;showContributions:boolean;cardTiersEnabled:boolean;cardBronzeMax:number;cardSilverMax:number;cardGoldMax:number } };
export type MatchAttendance = { id: string; playerId: string; playerName: string; photoUrl?: string | null; status: "PRESENT" | "ABSENT"; changeCount: number; maxChanges: number; updatedAt: string; administratorOverride?: boolean };
export type MatchWeather = { status: "AVAILABLE" | "OUT_OF_RANGE" | "LOCATION_NOT_FOUND" | "UNAVAILABLE"; fetchedAt: string; requestedAddress: string; resolvedAddress?: string; usedDefaultLocation?: boolean; temperatureMin?: number; temperatureMax?: number; apparentTemperature?: number; precipitationProbability?: number; precipitation?: number; windSpeed?: number; description?: string; icon?: string; message?: string; source?: string };
export type ScheduledMatch = {
  id: string; title: string; matchAt: string; confirmationDeadline: string; location?: string | null;
  maxChanges: number; status: "OPEN" | "CLOSED" | "CANCELLED"; acceptingResponses: boolean; separationId?: string | null;
  counts: { present: number; absent: number; pending: number }; attendance: MatchAttendance[];
  goalkeepers?: { present: number; max: number };
  shareMessage?: string;
  weather?: MatchWeather | null;
  viewer: { playerId: string | null; status: "PRESENT" | "ABSENT" | null; changeCount: number; changesRemaining: number; canRespond: boolean; isGoalkeeper?: boolean };
  createdAt: string; updatedAt: string;
};
export type MatchPlayer = { id: string; displayName: string; photoUrl?: string | null; type: string; primaryPosition: string };
export type MatchListPayload = { matches: ScheduledMatch[]; players?: MatchPlayer[]; serverNow: string };
export type AppNotification = { id: string; type: string; title: string; body: string; matchId?: string | null; actionUrl?: string | null; readAt?: string | null; createdAt: string };
export type NotificationPreferences = {
  attendanceInApp: boolean; attendancePush: boolean;
  matchesInApp: boolean; matchesPush: boolean;
  separationsInApp: boolean; separationsPush: boolean;
  appUpdatesInApp: boolean; appUpdatesPush: boolean;
  careerVotesPush: boolean; pageSize: number;
};
export type NotificationPage = {
  unread: number; total: number; page: number; pageSize: number; totalPages: number;
  hasPrevious: boolean; hasNext: boolean; notifications: AppNotification[];
};
