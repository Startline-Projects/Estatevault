import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

afterEach(() => {
  cleanup();
});
