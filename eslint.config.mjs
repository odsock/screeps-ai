// @ts-check

import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error"
    }
  }
);
