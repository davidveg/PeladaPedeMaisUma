import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { hallRecordBadgePath } from "../lib/hall-record-badges.ts";

const ids = ["games", "wins", "goals", "assists", "motmAwards", "socialAwards"];

test("resolve e entrega os emblemas da Ala dos Recordes", async () => {
  for (const id of ids) {
    const path = hallRecordBadgePath(id);
    assert.match(path, /^\/hall-of-fame\/records\/[a-z-]+\.png$/);
    await access(new URL(`../public${path}`, import.meta.url));
  }
  assert.equal(hallRecordBadgePath("unknown"), "");
});

test("site e aplicativo usam os emblemas com fallback", async () => {
  const [site, mobile] = await Promise.all([
    readFile(new URL("../app/hall-da-fama/HallOfFameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/hall-of-fame.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(site, /<HallRecordBadge id=\{record\.id\}/);
  assert.match(mobile, /<HallRecordBadge id=\{record\.id\}/);
});
