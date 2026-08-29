import { finalizeIfExpired } from "../../../../lib/career-service";
import { db, ensureDb } from "../../../../lib/database";
import { calculateAdvancedStatistics } from "../../../../lib/statistics-engine";
import { loadAdvancedStatisticsData } from "../../../../lib/statistics-data";
import type { StatisticsPosition } from "../../../../lib/statistics-types";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const positions = new Set(["Goleiro", "Defesa", "Meio-campo", "Ataque"]);

export async function GET(request: Request) {
  await ensureDb();
  const expired = await db().prepare(`SELECT * FROM career_matches WHERE status='OPEN' AND closes_at<=?`).bind(new Date().toISOString()).all();
  for (const match of expired.results) await finalizeIfExpired(match);
  const url = new URL(request.url), params = url.searchParams, now = new Date(), year = now.getFullYear();
  const from = isoDate.test(params.get("from") || "") ? params.get("from")! : `${year}-01-01`;
  const to = isoDate.test(params.get("to") || "") ? params.get("to")! : `${year}-12-31`;
  if (from > to) return Response.json({ error: "A data inicial deve ser anterior à data final." }, { status: 400 });
  const seasonValue = Number(params.get("season")), seasonNumber = Number.isInteger(seasonValue) && seasonValue > 0 ? seasonValue : null;
  const positionValue = params.get("position") || "", position = positions.has(positionValue) ? positionValue as StatisticsPosition : null;
  const recentValue = Number(params.get("recent")), recentWindow = ([5, 10, 20].includes(recentValue) ? recentValue : 5) as 5 | 10 | 20;
  const minimumGames = boundedInteger(params.get("minimumGames"), 1, 100, 1);
  const partnershipMinimumGames = boundedInteger(params.get("partnershipMinimumGames"), 1, 100, 3);
  const { players, matches } = await loadAdvancedStatisticsData(from, to);
  const statistics = calculateAdvancedStatistics(players, matches, { from, to, seasonNumber, position, recentWindow, minimumGames, partnershipMinimumGames });
  const seasons = [...new Set(matches.map(match => match.seasonNumber))].sort((left, right) => right - left);
  return Response.json({ from, to, seasons, allPlayers: players, ...statistics }, { headers: { "cache-control": "no-store, max-age=0" } });
}

function boundedInteger(value: string | null, minimum: number, maximum: number, fallback: number) {
  const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

