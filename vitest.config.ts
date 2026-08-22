import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST;

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});