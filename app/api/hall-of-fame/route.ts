import { loadHallOfFame } from "../../../lib/player-engagement-store";

export async function GET() {
  const hall = await loadHallOfFame();
  return Response.json(hall, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
}
