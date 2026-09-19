import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import WebSocket from "ws";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

class IPv4WebSocket extends WebSocket {
  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols, { family: 4 });
  }
}

// Node's automatic IPv4/IPv6 selection can time out against the Neon endpoint
// on some local networks. The same endpoint is reachable consistently via IPv4.
neonConfig.webSocketConstructor = IPv4WebSocket;

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
