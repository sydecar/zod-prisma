/// <reference types="vitest" />

import { defineConfig } from "vite"
import eslintPlugin from "vite-plugin-eslint"

export default defineConfig({
  test: {
    testTimeout: 20000,
  },
  plugins: [
    eslintPlugin({
      fix: true,
      include: [
        "src/**/*.ts",
        "src/*.ts",
        "test/**/*.test.ts",
        "test/*.test.ts",
      ],
    }),
  ],
})
