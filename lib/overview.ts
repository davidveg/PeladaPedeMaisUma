export type OverviewPlayer = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  type: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  overall: number;
  momentum: number;
  games: number;
  wins: number;
  losses: number;
  goals: number;
  assists: number;
};

export type OverviewMatch = {
  id: string;
  separationId: string | null;
  title: string;
  matchAt: string | null;
  location: string | null;
  status: "OPEN" | "TEAMS" | "FINISHED" | "CLOSED";
  confirmationDeadline: string | null;
  present: number | null;
  pending: number | null;
  viewerAttendanceStatus: "PRESENT" | "ABSENT" | "WAITLIST" | null;
  blueScore: number | null;
  yellowScore: number | null;
  weather: { description: string | null; icon: string | null; temperatureMin: number | null; temperatureMax: number | null; windSpeed: number | null } | null;
};

export type OverviewBalance = {
  separationId: string;
  title: string;
  date: string | null;
  classification: string;
  blueAverage: number | null;
  yellowAverage: number | null;
  difference: number | null;
  balancePercent: number | null;
  positionPercent: number | null;
  metrics: Array<{
    key: string;
    label: string;
    difference: number;
    differencePercent: number;
    balancePercent: number;
    advantage: "BLUE" | "YELLOW" | "EVEN";
  }>;
};

export type OverviewHighlight = {
  month: string;
  player: { id: string; displayName: string; photoUrl: string | null; primaryPosition: string | null };
  totalMomentum: number;
  games: number;
};

export type OverviewPayload = {
  player: OverviewPlayer | null;
  openMatch: OverviewMatch | null;
  latestMatch: OverviewMatch | null;
  recentMatches: OverviewMatch[];
  balance: OverviewBalance | null;
  highlight: OverviewHighlight | null;
  summary: { matchesThisYear: number; activePlayers: number; averageAttendance: number | null };
  viewer: { canManageMatches: boolean };
};
