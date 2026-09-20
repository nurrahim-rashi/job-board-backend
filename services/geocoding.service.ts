import { prisma } from "../lib/prisma.js";
import { geocodingUserAgent } from "./region.service.js";

export type Coordinates = { latitude: string; longitude: string };

const geocodeCache = new Map<string, Coordinates | null>();
let lastRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();
let backfillPromise: Promise<void> | null = null;

const normalizeLocation = (location: string) =>
  location
    .replace(/^(Kota Administrasi|Kabupaten|Kota)\s+/i, "")
    .trim()
    .toLocaleLowerCase("id-ID");

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function observeNominatimRateLimit() {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const remaining = 1_100 - (Date.now() - lastRequestAt);
  if (remaining > 0) await wait(remaining);
  lastRequestAt = Date.now();
  release();
}

export async function geocodeLocation(
  location: string,
  country = "Indonesia",
  province?: string | null,
): Promise<Coordinates | null> {
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) return null;
  const cacheKey = [country, province ?? "", normalizedLocation]
    .map((value) => value.trim().toLocaleLowerCase("en"))
    .join(":");
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  await observeNominatimRateLimit();
  // Another request may have filled the cache while this one waited in line.
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  try {
    const query = new URLSearchParams({
      q: [location, province, country].filter(Boolean).join(", "),
      format: "jsonv2",
      limit: "1",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${query.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "id,en",
          "User-Agent": geocodingUserAgent(),
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const latitude = results[0]?.lat;
    const longitude = results[0]?.lon;
    const coordinates =
      latitude && longitude && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
        ? { latitude, longitude }
        : null;
    geocodeCache.set(cacheKey, coordinates);
    return coordinates;
  } catch (error) {
    console.warn(
      `Could not geocode location "${[location, province, country].filter(Boolean).join(", ")}"`,
      error,
    );
    return null;
  }
}

export const geocodeIndonesianLocation = (location: string) =>
  geocodeLocation(location, "Indonesia");

async function runActiveJobCoordinateBackfill() {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { cityLocation: true, provinceLocation: true, countryLocation: true },
    take: 5,
  });

  const locations = new Map<
    string,
    {
      cityLocation: string;
      provinceLocation: string | null;
      countryLocation: string;
    }
  >();
  for (const job of jobs) {
    const key = [
      job.countryLocation,
      job.provinceLocation ?? "",
      normalizeLocation(job.cityLocation),
    ]
      .map((value) => value.toLocaleLowerCase("en"))
      .join(":");
    if (!key) continue;
    locations.set(key, {
      cityLocation: job.cityLocation,
      provinceLocation: job.provinceLocation,
      countryLocation: job.countryLocation,
    });
  }

  for (const location of locations.values()) {
    const coordinates = await geocodeLocation(
      location.cityLocation,
      location.countryLocation,
      location.provinceLocation,
    );
    if (!coordinates) continue;
    await prisma.jobPosting.updateMany({
      where: {
        cityLocation: {
          equals: location.cityLocation,
          mode: "insensitive",
        },
        countryLocation: {
          equals: location.countryLocation,
          mode: "insensitive",
        },
        OR: [{ latitude: null }, { longitude: null }],
      },
      data: coordinates,
    });
  }
}

export async function backfillActiveJobCoordinates() {
  if (!backfillPromise) {
    backfillPromise = runActiveJobCoordinateBackfill().finally(() => {
      backfillPromise = null;
    });
  }
  await backfillPromise;
}
