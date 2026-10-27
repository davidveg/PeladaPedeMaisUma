import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("substituição, votação, súmula e Hall reutilizam o mesmo seletor de jogadores com foto", async () => {
  const [component, matches, draft, voting, admin] = await Promise.all([
    readFile(new URL("../app/components/PlayerPhotoSelect.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sumula/MatchDraftApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/votacao/VotingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(component, /photoUrl\?: string \| null/);
  assert.match(component, /description\?: string \| null/);
  assert.match(component, /group\?: string \| null/);
  assert.match(component, /player-photo-option-group/);

  const replacement = matches.slice(matches.indexOf("function ClosedMatchReplacement"), matches.indexOf("export function MatchEditor"));
  assert.equal((replacement.match(/<PlayerPhotoSelect/g) || []).length, 2);
  assert.doesNotMatch(replacement, /<select/);
  assert.match(replacement, /group: `Time \$\{teamBlueName\}`/);
  assert.match(replacement, /group: group\.label/);

  assert.match(draft, /import \{ PlayerPhotoSelect \}/);
  assert.equal((draft.match(/<PlayerPhotoSelect/g) || []).length, 2);
  assert.doesNotMatch(draft, /<select value=\{goal\.(?:scorerPlayerId|assistPlayerId)\}/);
  assert.match(voting, /import \{ PlayerPhotoSelect \}/);
  const hall = admin.slice(admin.indexOf("function HallOfFameAdmin"), admin.indexOf("function CareerVoteManagement"));
  assert.match(admin, /import \{ PlayerPhotoSelect \}/);
  assert.match(hall, /<PlayerPhotoSelect/);
  assert.doesNotMatch(hall, /<select value=\{form\.playerId\}/);
  assert.match(hall, /player\.active\?'Jogadores ativos':'Jogadores inativos'/);
});
