import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".wrangler/**",
    ".wrangler-*/**",
    ".container-test-data/**",
    ".docker-config/**",
    "mobile/.expo/**",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // The existing request/database boundary code is still being typed incrementally.
      "@typescript-eslint/no-explicit-any": "off",
      // Several screens intentionally hydrate local state from async effects.
      "react-hooks/set-state-in-effect": "off",
      // Vinext pages intentionally use document navigation in several flows.
      "@next/next/no-html-link-for-pages": "off",
      // Uploaded and cross-origin images cannot use Next's optimizer reliably.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
