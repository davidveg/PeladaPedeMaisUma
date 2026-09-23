import assert from "node:assert/strict";
import test from "node:test";
import createExpoConfig from "../app.config.ts";

test("permite fundo próprio para o adaptive icon sem alterar a cor das notificações", () => {
  const previousPrimaryColor = process.env.EXPO_PRIMARY_COLOR;
  const previousAdaptiveBackground = process.env.EXPO_ADAPTIVE_BACKGROUND_COLOR;
  process.env.EXPO_PRIMARY_COLOR = "#440052";
  process.env.EXPO_ADAPTIVE_BACKGROUND_COLOR = "#FFFFFF";

  try {
    const result = createExpoConfig({ config: { name: "Peladix", slug: "peladix", plugins: [["expo-notifications", {}]] } });
    assert.equal(result.android?.adaptiveIcon?.backgroundColor, "#FFFFFF");
    assert.equal(result.plugins?.[0]?.[1]?.color, "#440052");
  } finally {
    if (previousPrimaryColor === undefined) delete process.env.EXPO_PRIMARY_COLOR;
    else process.env.EXPO_PRIMARY_COLOR = previousPrimaryColor;
    if (previousAdaptiveBackground === undefined) delete process.env.EXPO_ADAPTIVE_BACKGROUND_COLOR;
    else process.env.EXPO_ADAPTIVE_BACKGROUND_COLOR = previousAdaptiveBackground;
  }
});
