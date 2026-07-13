import assert from "node:assert/strict";
import test from "node:test";
import { logEvent } from "../lib/logger.ts";

test("logger produz uma linha JSON pesquisável", () => {
  const previous = console.log;
  let output = "";
  globalThis.__PELADA_LOG_LEVEL__ = "debug";
  console.log = (line) => { output = line; };
  try {
    logEvent("info", "test_event", { requestId: "request-1", status: 200 });
  } finally {
    console.log = previous;
    delete globalThis.__PELADA_LOG_LEVEL__;
  }
  const entry = JSON.parse(output);
  assert.equal(entry.level, "info");
  assert.equal(entry.service, "pelada-pede-mais-uma");
  assert.equal(entry.event, "test_event");
  assert.equal(entry.requestId, "request-1");
  assert.equal(entry.status, 200);
  assert.ok(entry.timestamp);
});
