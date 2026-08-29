import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppShareUrl } from "../lib/career-sharing.ts";
import { buildMonthlyPaymentsWhatsAppMessage } from "../lib/finance-sharing.ts";

test("monta parcial mensal ordenada com pagamentos, antecipação e chave Pix", () => {
  const message = buildMonthlyPaymentsWhatsAppMessage({
    competence: "2026-08",
    pixKey: "vinicius.rego@ifrj.edu.br",
    defaultMonthlyFeeCents: 7000,
    charges: [
      { playerName: "William", amountCents: 7000, paidCents: 7000, competence: "2026-08", storedStatus: "PAID", lastPaidAt: "2026-08-04T12:00:00.000Z" },
      { playerName: "Felipe G", amountCents: 7000, paidCents: 3500, competence: "2026-08", storedStatus: "PENDING", lastPaidAt: "2026-08-05T12:00:00.000Z" },
      { playerName: "Cussa", amountCents: 7000, paidCents: 7000, competence: "2026-08", storedStatus: "PAID", lastPaidAt: "2026-07-28T12:00:00.000Z" },
      { playerName: "Antonio", amountCents: 7000, paidCents: 0, competence: "2026-08", storedStatus: "PENDING" },
      { playerName: "Índio", amountCents: 7000, paidCents: 0, competence: "2026-08", storedStatus: "EXEMPT" },
    ],
  });

  assert.match(message, /^\*Pagamento agosto 2026:\*/);
  assert.match(message, /1 - Antonio: *\n2 - Cussa: ✅ \(antecipou\)/);
  assert.match(message, /3 - Felipe G: 🟡 parcial: R\$ 35,00 de R\$ 70,00/);
  assert.match(message, /4 - Índio: ISENTO\n5 - William: ✅/);
  assert.match(message, /\*ATENÇÃO: PIX para pagamento:\* vinicius\.rego@ifrj\.edu\.br/);
  assert.ok(message.endsWith("Valor: R$ 70,00"));
  assert.equal(new URL(buildWhatsAppShareUrl(message)).searchParams.get("text"), message);
});

test("avisa quando existem valores personalizados e não imprime Pix vazio", () => {
  const message = buildMonthlyPaymentsWhatsAppMessage({
    competence: "2026-09",
    pixKey: "",
    defaultMonthlyFeeCents: 10000,
    charges: [
      { playerName: "Ana", amountCents: 8000, paidCents: 0, competence: "2026-09", storedStatus: "PENDING" },
      { playerName: "Beto", amountCents: 10000, paidCents: 0, competence: "2026-09", storedStatus: "CANCELLED" },
      { playerName: "Caio", amountCents: 10000, paidCents: 0, competence: "2026-09", storedStatus: "PENDING" },
    ],
  });
  assert.doesNotMatch(message, /PIX/);
  assert.match(message, /Beto: CANCELADO/);
  assert.match(message, /Valor padrão: R\$ 100,00/);
  assert.match(message, /Alguns mensalistas possuem valor personalizado/);
});

test("omite goleiros isentos ou cancelados sem esconder cobranças válidas", () => {
  const message = buildMonthlyPaymentsWhatsAppMessage({
    competence: "2026-10",
    pixKey: "pix@example.com",
    defaultMonthlyFeeCents: 7000,
    charges: [
      { playerName: "Aranha", playerType: "goalkeeper", amountCents: 7000, paidCents: 0, competence: "2026-10", storedStatus: "EXEMPT" },
      { playerName: "Bruno", playerType: "monthly", amountCents: 7000, paidCents: 0, competence: "2026-10", storedStatus: "EXEMPT" },
      { playerName: "Lourenço", playerType: "goalkeeper", amountCents: 7000, paidCents: 0, competence: "2026-10", storedStatus: "CANCELLED" },
      { playerName: "Renato", playerType: "goalkeeper", amountCents: 7000, paidCents: 7000, competence: "2026-10", storedStatus: "PAID", lastPaidAt: "2026-10-03T12:00:00.000Z" },
      { playerName: "William", playerType: "monthly", amountCents: 7000, paidCents: 0, competence: "2026-10", storedStatus: "PENDING" },
    ],
  });

  assert.doesNotMatch(message, /Aranha|Lourenço/);
  assert.match(message, /1 - Bruno: ISENTO/);
  assert.match(message, /2 - Renato: ✅/);
  assert.match(message, /3 - William:/);
});
