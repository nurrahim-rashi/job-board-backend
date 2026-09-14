import { prisma } from "../lib/prisma.js";

type Coordinates = { latitude: string; longitude: string };

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

async function observeNominatimRateLimit() {
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

export async function geocodeIndonesianLocation(
  location: string,
): Promise<Coordinates | null> {
  const cacheKey = normalizeLocation(location);
  if (!cacheKey) return null;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  await observeNominatimRateLimit();
  // Another request may have filled the cache while this one waited in line.
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  try {
    const query = new URLSearchParams({
      q: `${location}, Indonesia`,
      format: "jsonv2",
      countrycodes: "id",
      limit: "1",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${query.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "id,en",
          "User-Agent": process.env.GEOCODING_USER_AGENT ?? "PolarisJobBoard/1.0",
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
    console.warn(`Could not geocode location "${location}"`, error);
    return null;
  }
}

async function runActiveJobCoordinateBackfill() {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { cityLocation: true },
    take: 5,
  });

  const locations = new Map<string, string>();
  for (const job of jobs) {
    const key = normalizeLocation(job.cityLocation);
    if (!key) continue;
    locations.set(key, job.cityLocation);
  }

  for (const location of locations.values()) {
    const coordinates = await geocodeIndonesianLocation(location);
    if (!coordinates) continue;
    await prisma.jobPosting.updateMany({
      where: {
        cityLocation: { equals: location, mode: "insensitive" },
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
