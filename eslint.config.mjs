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
  ]),
  {
    rules: {
      complexity: ["warn", 10],
      // setState-in-effect flags common valid React patterns (guard clauses, form resets,
      // derived state from props) — too strict for our use cases.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
