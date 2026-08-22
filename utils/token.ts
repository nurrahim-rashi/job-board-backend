import { createHash, randomBytes } from "node:crypto";

export function createOneTimeToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
