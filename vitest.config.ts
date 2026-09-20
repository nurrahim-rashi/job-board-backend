import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST;

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    fileParallelism: false,
    // `npm run build` compiles the suite into dist/, where vitest would collect
    // the stale copies alongside the sources and run every integration test
    // twice against older code.
    exclude: ["**/node_modules/**", "dist/**", "generated/**"],
  },
});
