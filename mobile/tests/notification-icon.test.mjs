import assert from "node:assert/strict";
import test from "node:test";
import { notificationIcon } from "../src/notification-icon.ts";

test("diferencia presença e ausência nas notificações", () => {
  assert.equal(notificationIcon("ATTENDANCE_CHANGED", "Presença confirmada"), "✅");
  assert.equal(notificationIcon("ATTENDANCE_CHANGED", "Ausência informada"), "❌");
});

test("preserva os demais ícones da central de notificações", () => {
  assert.equal(notificationIcon("APP_RELEASED", "Nova versão"), "⬆️");
  assert.equal(notificationIcon("MATCH_CREATED", "Nova partida"), "📅");
  assert.equal(notificationIcon("MATCH_CANCELLED", "Partida cancelada"), "🚫");
  assert.equal(notificationIcon("UNKNOWN", "Aviso"), "📣");
});
