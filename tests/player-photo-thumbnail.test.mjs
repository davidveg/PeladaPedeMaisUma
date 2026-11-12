import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mobilePlayerPhotoUrl } from "../mobile/src/player-photo-url.ts";

test("avatar pequeno usa miniatura e a ampliação usa a foto original sob demanda", async () => {
  const source = await readFile(new URL("../app/components/PlayerPhoto.tsx", import.meta.url), "utf8");
  assert.match(source, /large \? photoUrl : playerPhotoThumbnailUrl\(photoUrl\)/);
  assert.match(source, /preview && photoUrl[\s\S]*<img src=\{photoUrl\}/);
  assert.match(source, /loading=\{large \? "eager" : "lazy"\}/);
});

test("aplicativo móvel pede miniatura para avatares gerenciados", () => {
  assert.equal(
    mobilePlayerPhotoUrl("/api/upload?key=players%2Fphoto.webp", "https://pelada.example"),
    "https://pelada.example/api/upload?key=players%2Fphoto.webp&variant=thumbnail",
  );
  assert.equal(
    mobilePlayerPhotoUrl("https://cdn.example/photo.webp", "https://pelada.example"),
    "https://cdn.example/photo.webp",
  );
});
