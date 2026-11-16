import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { achievementBadgeKey, achievementBadgePath } from "../lib/achievement-badges.ts";

test("resolve badges canônicos e ids compostos", () => {
  assert.equal(achievementBadgeKey("hat_trick"), "hat_trick");
  assert.equal(achievementBadgeKey("hat_trick:player-1"), "hat_trick");
  assert.equal(achievementBadgeKey("perfect_season_8"), "perfect_season");
  assert.equal(achievementBadgeKey("perfect_season_8:player-1"), "perfect_season");
  assert.equal(achievementBadgeKey("undefeated_season_8"), "undefeated_season");
  assert.equal(achievementBadgeKey("undefeated_season_8:player-1"), "undefeated_season");
  assert.equal(achievementBadgePath("social_10"), "/achievements/social_10.png");
});

test("o manifesto e os arquivos incluem os novos emblemas", async () => {
  const ids = ["clean_sheet_win", "scoring_streak_3", "assist_streak_3", "contribution_streak_5", "trident", "perfect_table", "dynamic_duo", "gala_night", "partner_5", "defense_5", "fair_play_5", "undefeated_season", "decisive_and_liked", "goal_contributions_10", "goal_contributions_50", "goal_contributions_100", "motm_10", "attendance_25", "player_of_month_3", "monthly_selection_5"];
  const manifest = JSON.parse(await readFile(new URL("../public/achievements/manifest.json", import.meta.url), "utf8"));
  for (const id of ids) {
    assert.equal(typeof manifest.achievements[id], "string", id);
    const file = await stat(new URL(`../public/achievements/${id}.png`, import.meta.url));
    assert.ok(file.size > 10_000, id);
  }
});
