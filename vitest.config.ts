import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Persist unit results to disk (alongside Playwright's test-results/).
    reporters: [
      "default",
      ["json", { outputFile: "test-results/unit/results.json" }],
      ["junit", { outputFile: "test-results/unit/junit.xml" }],
    ],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/api/**/*.test.{ts,tsx}",
      "lib/crypto/__tests__/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
