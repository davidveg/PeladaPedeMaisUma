export type StatisticsPosition = "Goleiro" | "Defesa" | "Meio-campo" | "Ataque";

export type AdvancedStatisticsPlayer = {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  type?: string | null;
  primaryPosition?: string | null;
};

export type StatisticsParticipant = { playerId: string; position: StatisticsPosition | "" };
export type StatisticsContributionFact = { scorerPlayerId: string; assistPlayerId?: string | null; ownGoal: boolean };
export type StatisticsVoteFact = {
  motmFirstId: string; motmSecondId: string; motmThirdId: string;
  dotmFirstId: string; dotmSecondId: string; dotmThirdId: string;
};

export type AdvancedStatisticsMatch = {
  id: string;
  separationId: string;
  title: string;
  date: string;
  status: string;
  seasonNumber: number;
  manuallyAdjusted: boolean;
  blueScore: number;
  yellowScore: number;
  winnerTeam: "BLUE" | "YELLOW" | "DRAW";
  blue: StatisticsParticipant[];
  yellow: StatisticsParticipant[];
  contributions: StatisticsContributionFact[];
  contributionsAvailable?: boolean;
  votes: StatisticsVoteFact[];
  prediction?: {
    blueStrength: number | null;
    yellowStrength: number | null;
    balanceCost: number | null;
    classification: string | null;
    algorithmVersion: number | null;
  };
};

export type AdvancedStatisticsFilters = {
  from?: string;
  to?: string;
  seasonNumber?: number | null;
  position?: StatisticsPosition | null;
  minimumGames?: number;
  recentWindow?: 5 | 10 | 20;
  partnershipMinimumGames?: number;
};

export type ConfidenceLevel = "Baixa" | "Média" | "Alta";
