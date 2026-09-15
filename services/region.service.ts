import { ApiError } from "../utils/api-error.js";

const baseUrl = "https://wilayah.id/api";
const cache = new Map<string, { expiresAt: number; data: unknown }>();

export type Country = { code: string; name: string };

export async function getCountries(): Promise<Country[]> {
  const cacheKey = "countries";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Country[];
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2", {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`REST Countries returned ${response.status}`);
    const payload = await response.json() as Array<{ cca2?: string; name?: { common?: string } }>;
    const countries = payload
      .filter((country) => country.cca2 && country.name?.common)
      .map((country) => ({ code: country.cca2!, name: country.name!.common! }))
      .sort((a, b) => a.name.localeCompare(b.name));
    cache.set(cacheKey, { expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, data: countries });
    return countries;
  } catch (error) {
    console.error("Unable to load countries", error);
    return [{ code: "ID", name: "Indonesia" }];
  }
}

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
