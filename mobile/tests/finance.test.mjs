import assert from "node:assert/strict";
import test from "node:test";
import { competenceLabel, financeEntryVisible, money, monthlyPaymentsMessage, moveCompetence } from "../src/finance.ts";

test("respeita ativação, associação e permissão financeira na aba", () => {
  assert.equal(financeEntryVisible({ role: "player", playerId: "player-1" }, true), true);
  assert.equal(financeEntryVisible({ role: "player", playerId: "player-1" }, false), false);
  assert.equal(financeEntryVisible({ role: "moderator", playerId: null, permissions: ["FINANCE_MANAGE"] }, true), true);
  assert.equal(financeEntryVisible({ role: "moderator", playerId: null, permissions: [] }, true), false);
  assert.equal(financeEntryVisible({ role: "admin", playerId: null }, true), true);
});

test("formata competência e navega entre anos em português", () => {
  assert.equal(competenceLabel("2026-08"), "Agosto de 2026");
  assert.equal(moveCompetence("2026-01", -1), "2025-12");
  assert.equal(moveCompetence("2026-12", 1), "2027-01");
});

test("monta a mesma parcial financeira usada pelo site", () => {
  const message = monthlyPaymentsMessage({
    viewer: { canManage: true }, competence: "2026-08",
    settings: { defaultMonthlyFeeCents: 7000, pixKey: "vinicius.rego@ifrj.edu.br" },
    charges: [
      { id: "2", playerName: "William", type: "MONTHLY_FEE", description: "Mensalidade", amountCents: 7000, paidCents: 7000, remainingCents: 0, competence: "2026-08", dueDate: "2026-08-10", status: "PAID", storedStatus: "PAID", lastPaidAt: "2026-08-02T12:00:00.000Z" },
      { id: "1", playerName: "Antonio", type: "MONTHLY_FEE", description: "Mensalidade", amountCents: 7000, paidCents: 0, remainingCents: 7000, competence: "2026-08", dueDate: "2026-08-10", status: "PENDING", storedStatus: "PENDING" },
      { id: "3", playerName: "Cussa", type: "MONTHLY_FEE", description: "Mensalidade", amountCents: 7000, paidCents: 7000, remainingCents: 0, competence: "2026-08", dueDate: "2026-08-10", status: "PAID", storedStatus: "PAID", lastPaidAt: "2026-07-28T12:00:00.000Z" },
    ],
  });
  assert.match(message, /Pagamento agosto 2026/);
  assert.match(message, /1 - Antonio:\n2 - Cussa: ✅ \(antecipou\)\n3 - William: ✅/);
  assert.match(message, /PIX para pagamento:\* vinicius\.rego@ifrj\.edu\.br/);
  assert.ok(message.includes(`Valor: ${money(7000)}`));
});
