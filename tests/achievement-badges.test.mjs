import assert from "node:assert/strict";
import test from "node:test";
import { achievementBadgeKey, achievementBadgePath } from "../lib/achievement-badges.ts";

test("resolve badges canônicos e ids compostos", () => {
  assert.equal(achievementBadgeKey("hat_trick"), "hat_trick");
  assert.equal(achievementBadgeKey("hat_trick:player-1"), "hat_trick");
  assert.equal(achievementBadgeKey("perfect_season_8"), "perfect_season");
  assert.equal(achievementBadgeKey("perfect_season_8:player-1"), "perfect_season");
  assert.equal(achievementBadgePath("social_10"), "/achievements/social_10.png");
});
