import assert from "node:assert/strict";
import test from "node:test";
import { brazilianDateInput, brazilianDateTimeIso, brazilianDateTimeParts, brazilianTimeInput } from "../lib/brazilian-date-time.ts";

test("apresenta data e hora administrativas no padrão brasileiro", () => {
  assert.deepEqual(brazilianDateTimeParts("2026-08-04T23:30:00.000Z"), { date: "04/08/2026", time: "20:30" });
});

test("converte data brasileira válida para o ISO esperado pela API", () => {
  assert.equal(brazilianDateTimeIso("04/08/2026", "20:30"), "2026-08-04T23:30:00.000Z");
  assert.equal(brazilianDateTimeIso("31/02/2026", "20:30"), "");
  assert.equal(brazilianDateTimeIso("04/08/2026", "24:00"), "");
});

test("insere as barras durante a digitação da data", () => {
  assert.equal(brazilianDateInput("04082026"), "04/08/2026");
  assert.equal(brazilianDateInput("04/08/2026"), "04/08/2026");
  assert.equal(brazilianTimeInput("2030"), "20:30");
});
