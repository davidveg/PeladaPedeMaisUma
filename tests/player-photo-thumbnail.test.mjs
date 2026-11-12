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

test("seleção do mês mantém o aro branco dentro do avatar circular", async () => {
  const source = await readFile(new URL("../app/estatisticas/statistics.css", import.meta.url), "utf8");
  assert.match(source, /\.formation-line article>\.player-avatar-wrap>\.player-photo\{[^}]*box-sizing:border-box[^}]*border:3px solid #fff[^}]*border-radius:50%/);
  assert.match(source, /\.formation-line article>\.player-avatar-wrap>\.player-photo>img\{[^}]*border:0[^}]*border-radius:50%/);
  assert.match(source, /\.monthly-player-trigger>\.player-avatar-wrap>\.player-photo\{[^}]*border:3px solid #fff[^}]*background:transparent/);
  assert.match(source, /\.monthly-momentum-panel\{[^}]*position:absolute[^}]*background:linear-gradient/);
  assert.match(source, /\.monthly-momentum-panel>header\{[^}]*background:linear-gradient\(135deg,#f0d47f,#d4a43e\)[^}]*color:#123c2f/);
});

test("seleção mensal abre o quadro de composição e usa a foto original nele", async () => {
  const source = await readFile(new URL("../app/estatisticas/StatisticsApp.tsx", import.meta.url), "utf8");
  assert.match(source, /<MonthlyMomentumPanel standing=\{selected\}/);
  assert.match(source, /className="monthly-momentum-panel"[\s\S]*<PlayerPhoto photoUrl=\{standing\.player\.photoUrl\} name=\{standing\.player\.displayName\} large\/>/);
  assert.match(source, /hoverPreview=\{false\}/);
});
