import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import WebSocket from "ws";
import { ApiError } from "../utils/api-error.js";

const connectionString = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.DATABASE_URL_UNPOOLED,
].find((value) => value?.trim());

class IPv4WebSocket extends WebSocket {
  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols, { family: 4 });
  }
}

// Node's automatic IPv4/IPv6 selection can time out against the Neon endpoint
// on some local networks. The same endpoint is reachable consistently via IPv4.
let prisma: PrismaClient;

if (connectionString) {
  neonConfig.webSocketConstructor = IPv4WebSocket;
  const adapter = new PrismaNeon({ connectionString });
  prisma = new PrismaClient({ adapter });
} else {
  // Keep the Express function alive so health checks and CORS preflight still
  // work. Database-backed requests receive a readable configuration error
  // instead of Vercel terminating the function during module initialization.
  prisma = new Proxy({} as PrismaClient, {
    get: (_target, property) => {
      if (property === "$disconnect") return async () => undefined;
      throw new ApiError(
        "Database is not configured. Set DATABASE_URL in the backend deployment.",
        503,
      );
    },
  });
}

export { prisma };
