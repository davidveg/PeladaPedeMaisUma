import test from "node:test";
import assert from "node:assert/strict";
import { buildVotingUrl, buildWhatsAppShareUrl, buildWhatsAppVotingMessage } from "../lib/career-sharing.ts";
import { normalizePublicBaseUrl, resolvePublicBaseUrl } from "../lib/public-url.ts";

test("monta a URL de votação a partir do endereço público", () => {
  assert.equal(
    buildVotingUrl("https://pelada.example.com/", "token com espaço"),
    "https://pelada.example.com/votacao?token=token%20com%20espa%C3%A7o",
  );
});

test("deixa o link do WhatsApp isolado em uma linha", () => {
  const votingUrl = "https://pelada.example.com/votacao?token=abc123";
  const message = buildWhatsAppVotingMessage({
    matchTitle: "*PELADA - 12/07 Batista*",
    votingUrl,
    closesAt: "2026-07-19T18:00:00.000Z",
  });

  assert.match(message, /🏆 \*Votação dos destaques\*/);
  assert.match(message, /PELADA - 12\/07 Batista/);
  assert.ok(message.includes(`*Acesse e vote:*\n${votingUrl}\n\n⏳`));
  assert.equal(message.includes("*PELADA - 12/07 Batista*"), false);
});

test("preserva emojis e acentos na URL enviada ao WhatsApp", () => {
  const message = buildWhatsAppVotingMessage({
    matchTitle: "PELADA - 19/07 Batista",
    votingUrl: "https://pelada.example.com/votacao?token=abc123",
    closesAt: "2026-07-20T15:05:29.000Z",
  });
  const shareUrl = buildWhatsAppShareUrl(message);
  const decodedMessage = new URL(shareUrl).searchParams.get("text");

  assert.equal(decodedMessage, message);
  assert.equal(message.includes("�"), false);
  assert.ok(message.includes(String.fromCodePoint(0x26bd, 0xfe0f)));
  assert.ok(message.includes(String.fromCodePoint(0x1f3c6)));
  assert.ok(message.includes(String.fromCodePoint(0x1f449)));
  assert.ok(message.includes(String.fromCodePoint(0x23f3)));
});

test("prioriza APP_BASE_URL e remove barra final", () => {
  const request = new Request("http://localhost:3000/api/public-config", {
    headers: { "x-forwarded-host": "proxy.example.com", "x-forwarded-proto": "https" },
  });
  assert.equal(resolvePublicBaseUrl(request, "https://pelada.example.com/"), "https://pelada.example.com");
});

test("usa os cabeçalhos do proxy quando não há endereço configurado", () => {
  const request = new Request("http://localhost:3000/api/public-config", {
    headers: { "x-forwarded-host": "pelada.example.com", "x-forwarded-proto": "https" },
  });
  assert.equal(resolvePublicBaseUrl(request), "https://pelada.example.com");
  assert.equal(normalizePublicBaseUrl("javascript:alert(1)"), "");
});
