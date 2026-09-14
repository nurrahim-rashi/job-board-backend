import { ApiError } from "../utils/api-error.js";

const baseUrl = "https://wilayah.id/api";
const cache = new Map<string, { expiresAt: number; data: unknown }>();

export async function getRegions(path: string) {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const response = await fetch(`${baseUrl}/${path}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Wilayah.id returned ${response.status}`);
    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error("Invalid Wilayah.id response");
    cache.set(path, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, data: payload.data });
    return payload.data;
  } catch (error) {
    console.error("Unable to load regions", error);
    throw new ApiError("Indonesian region data is temporarily unavailable", 502);
  }
}
