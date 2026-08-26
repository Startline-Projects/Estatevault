import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Persist unit results to disk. Use a dedicated dir — Playwright wipes its
    // own test-results/ on every run, which would clobber these.
    reporters: [
      "default",
      ["json", { outputFile: "reports/unit/results.json" }],
      ["junit", { outputFile: "reports/unit/junit.xml" }],
    ],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/api/**/*.test.{ts,tsx}",
      "lib/crypto/__tests__/**/*.test.ts",
      // Document-generation tests live beside their sources. Without this glob
      // the whole suite under lib/documents/ was collected by nobody and never ran.
      "lib/documents/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
