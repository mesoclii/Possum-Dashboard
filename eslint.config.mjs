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
    ".next.previous/**",
    ".next.cache.hold/**",
    ".backup_*/**",
    ".backup*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".next.rollback.json",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Keep the newer React Compiler diagnostics visible without blocking
      // the legacy dashboard lint gate during the broader component migration.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    files: ["**/*.js", "**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
