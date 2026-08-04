import assert from "node:assert/strict";
import test from "node:test";
import { detectImageType } from "../lib/image-upload.ts";

test("reconhece um favicon ICO pela assinatura binária", () => {
  assert.deepEqual(detectImageType(Uint8Array.of(0x00, 0x00, 0x01, 0x00)), {
    contentType: "image/x-icon",
    extension: "ico",
  });
});

test("não aceita conteúdo arbitrário como imagem", () => {
  assert.equal(detectImageType(new TextEncoder().encode("não é uma imagem")), null);
});
