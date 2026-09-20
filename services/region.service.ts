import { ApiError } from "../utils/api-error.js";
import { observeNominatimRateLimit } from "./geocoding.service.js";

const baseUrl = "https://wilayah.id/api";
const countriesNowBaseUrl = "https://countriesnow.space/api/v0.1";
const cache = new Map<string, { expiresAt: number; data: unknown }>();

const indonesianProvinceAliases: Record<string, string> = {
  jawa: "Jawa Barat",
  "north sumatra": "Sumatera Utara",
  "west sumatra": "Sumatera Barat",
  "south sumatra": "Sumatera Selatan",
  "riau islands": "Kepulauan Riau",
  "bangka belitung islands": "Kepulauan Bangka Belitung",
  "west java": "Jawa Barat",
  "central java": "Jawa Tengah",
  "east java": "Jawa Timur",
  "special region of yogyakarta": "Daerah Istimewa Yogyakarta",
  "west nusa tenggara": "Nusa Tenggara Barat",
  "east nusa tenggara": "Nusa Tenggara Timur",
  "west kalimantan": "Kalimantan Barat",
  "central kalimantan": "Kalimantan Tengah",
  "south kalimantan": "Kalimantan Selatan",
  "east kalimantan": "Kalimantan Timur",
  "north kalimantan": "Kalimantan Utara",
  "north sulawesi": "Sulawesi Utara",
  "central sulawesi": "Sulawesi Tengah",
  "south sulawesi": "Sulawesi Selatan",
  "southeast sulawesi": "Sulawesi Tenggara",
  "west sulawesi": "Sulawesi Barat",
  "north maluku": "Maluku Utara",
  "west papua": "Papua Barat",
  "southwest papua": "Papua Barat Daya",
  "central papua": "Papua Tengah",
  "highland papua": "Papua Pegunungan",
  "south papua": "Papua Selatan",
  "jakarta special capital region": "DKI Jakarta",
};

const indonesianCityAliases: Record<string, string> = {
  "bandung barat": "Kabupaten Bandung Barat",
  "west bandung": "Kabupaten Bandung Barat",
  "west bandung regency": "Kabupaten Bandung Barat",
};

function normalizeIndonesianProvinceName(name?: string) {
  const original = name?.trim();
  if (!original) return undefined;
  return (
    indonesianProvinceAliases[original.toLocaleLowerCase("en")] ?? original
  );
}

function normalizeIndonesianCityName(name?: string) {
  const original = name?.trim();
  if (!original) return undefined;
  return indonesianCityAliases[original.toLocaleLowerCase("en")] ?? original;
}

export function provinceSearchNames(name?: string) {
  if (!name?.trim()) return [];
  const original = name.trim();
  const canonical = normalizeIndonesianProvinceName(original);
  return [
    ...new Set(
      [original, canonical].filter((value): value is string => Boolean(value)),
    ),
  ];
}

export type Country = { code: string; name: string };

export type WorldwideLocation = {
  id: string;
  name: string;
  label: string;
  type: "city" | "state" | "country";
  province: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  properties?: {
    osm_type?: string;
    osm_id?: number;
    type?: "city" | "county" | "state" | "country";
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

type NominatimReverseResult = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
    country_code?: string;
  };
};

type BigDataCloudReverseResult = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  localityInfo?: {
    administrative?: Array<{
      name?: string;
      description?: string;
    }>;
  };
};

export type ReverseGeocodedLocation = {
  city: string;
  province: string;
  country: string;
  countryCode: string;
};

let photonQueue: Promise<void> = Promise.resolve();
let lastPhotonRequestAt = 0;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function observePhotonRateLimit() {
  const previous = photonQueue;
  let release!: () => void;
  photonQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const remaining = 350 - (Date.now() - lastPhotonRequestAt);
  if (remaining > 0) await wait(remaining);
  lastPhotonRequestAt = Date.now();
  release();
}

const uniqueParts = (...parts: Array<string | undefined>) => {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const value = part?.trim();
    if (!value) return false;
    const key = value.toLocaleLowerCase("en");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function searchWorldwideLocations(
  search: string,
): Promise<WorldwideLocation[]> {
  const query = search.trim().slice(0, 80);
  if (query.length < 2) return [];

  const cacheKey = `worldwide-location:${query.toLocaleLowerCase("en")}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now())
    return cached.data as WorldwideLocation[];

  await observePhotonRateLimit();
  const queuedCache = cache.get(cacheKey);
  if (queuedCache && queuedCache.expiresAt > Date.now())
    return queuedCache.data as WorldwideLocation[];

  try {
    const params = new URLSearchParams({ q: query, limit: "12", lang: "en" });
    for (const layer of ["city", "county", "state", "country"])
      params.append("layer", layer);

    const photonBaseUrl = (
      process.env.PHOTON_API_URL ?? "https://photon.komoot.io"
    ).replace(/\/$/, "");
    const response = await fetch(`${photonBaseUrl}/api/?${params.toString()}`, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent":
          process.env.GEOCODING_USER_AGENT ?? "PolarisJobBoard/1.0",
      },
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);

    const payload = (await response.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const locations = (payload.features ?? [])
      .map((feature): WorldwideLocation | null => {
        const properties = feature.properties;
        const coordinates = feature.geometry?.coordinates;
        const name = properties?.name?.trim();
        const country = properties?.country?.trim();
        const longitude = coordinates?.[0];
        const latitude = coordinates?.[1];
        if (
          !properties?.type ||
          !name ||
          !country ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        )
          return null;

        const type =
          properties.type === "country"
            ? "country"
            : properties.type === "state"
              ? "state"
              : "city";
        const label = uniqueParts(
          name,
          type === "city" ? properties.state : undefined,
          country,
        ).join(", ");
        const dedupeKey = `${type}:${label.toLocaleLowerCase("en")}`;
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);

        return {
          id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? dedupeKey}`,
          name,
          label,
          type,
          province: properties.state?.trim() || null,
          country,
          countryCode: properties.countrycode?.toUpperCase() ?? "",
          latitude: latitude!,
          longitude: longitude!,
        };
      })
      .filter((location): location is WorldwideLocation => location !== null)
      .slice(0, 8);

    cache.set(cacheKey, {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      data: locations,
    });
    return locations;
  } catch (error) {
    console.error(`Unable to search worldwide locations for "${query}"`, error);
    return [];
  }
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedLocation> {
  const cacheKey = `reverse:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now())
    return cached.data as ReverseGeocodedLocation;

  let photonError: unknown;
  try {
    await observePhotonRateLimit();
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      lang: "en",
    });
    const photonBaseUrl = (
      process.env.PHOTON_API_URL ?? "https://photon.komoot.io"
    ).replace(/\/$/, "");
    const response = await fetch(`${photonBaseUrl}/reverse?${params.toString()}`, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": process.env.GEOCODING_USER_AGENT ?? "PolarisJobBoard/1.0",
      },
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);
    const payload = (await response.json()) as { features?: PhotonFeature[] };
    const properties = payload.features?.[0]?.properties;
    const localCity = (properties?.city ||
      (properties?.type === "city" ? properties.name : undefined) ||
      properties?.county || properties?.name)?.trim();
    const country = properties?.country?.trim();
    const isIndonesia = country?.toLocaleLowerCase("en") === "indonesia";
    const city = isIndonesia
      ? normalizeIndonesianCityName(properties?.county || localCity)
      : localCity;
    const rawProvince =
      properties?.state?.trim() || properties?.county?.trim() || city;
    const province =
      isIndonesia
        ? normalizeIndonesianProvinceName(rawProvince)
        : rawProvince;
    if (!city || !province || !country)
      throw new Error("Reverse geocoder returned an incomplete location");
    const location: ReverseGeocodedLocation = {
      city,
      province,
      country,
      countryCode: properties?.countrycode?.toUpperCase() ?? "",
    };
    cache.set(cacheKey, {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      data: location,
    });
    return location;
  } catch (error) {
    photonError = error;
  }

  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "12",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: "application/json",
          "Accept-Language": "en,id",
          "User-Agent": process.env.GEOCODING_USER_AGENT ?? "PolarisJobBoard/1.0",
        },
      },
    );
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const address = ((await response.json()) as NominatimReverseResult).address;
    const country = address?.country?.trim();
    const isIndonesia = country?.toLocaleLowerCase("en") === "indonesia";
    const city = isIndonesia
      ? normalizeIndonesianCityName(
          uniqueParts(
            address?.county,
            address?.municipality,
            address?.city,
            address?.town,
            address?.village,
          )[0],
        )
      : uniqueParts(
          address?.city,
          address?.town,
          address?.village,
          address?.municipality,
          address?.county,
        )[0];
    const rawProvince =
      address?.state?.trim() ||
      address?.region?.trim() ||
      address?.county?.trim() ||
      city;
    const province =
      isIndonesia
        ? normalizeIndonesianProvinceName(rawProvince)
        : rawProvince;
    if (!city || !province || !country)
      throw new Error("Nominatim returned an incomplete location");
    const location: ReverseGeocodedLocation = {
      city,
      province,
      country,
      countryCode: address?.country_code?.toUpperCase() ?? "",
    };
    cache.set(cacheKey, {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      data: location,
    });
    return location;
  } catch (nominatimError) {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        localityLanguage: "en",
      });
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
        {
          signal: AbortSignal.timeout(8_000),
          headers: {
            Accept: "application/json",
            "User-Agent":
              process.env.GEOCODING_USER_AGENT ?? "PolarisJobBoard/1.0",
          },
        },
      );
      if (!response.ok)
        throw new Error(`BigDataCloud returned ${response.status}`);

      const payload = (await response.json()) as BigDataCloudReverseResult;
      const country = payload.countryName?.trim();
      const isIndonesia = country?.toLocaleLowerCase("en") === "indonesia";
      const administrativeCity = payload.localityInfo?.administrative?.find(
        (entry) =>
          entry.name &&
          /regency|city|municipality|kabupaten|kota/i.test(
            `${entry.description ?? ""} ${entry.name}`,
          ),
      )?.name;
      const cityCandidate =
        administrativeCity || payload.city || payload.locality;
      const city = isIndonesia
        ? normalizeIndonesianCityName(cityCandidate)
        : cityCandidate?.trim();
      const province = isIndonesia
        ? normalizeIndonesianProvinceName(payload.principalSubdivision)
        : payload.principalSubdivision?.trim();
      if (!city || !province || !country)
        throw new Error("BigDataCloud returned an incomplete location");

      const location: ReverseGeocodedLocation = {
        city,
        province,
        country,
        countryCode: payload.countryCode?.toUpperCase() ?? "",
      };
      cache.set(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        data: location,
      });
      return location;
    } catch (bigDataCloudError) {
      console.error("Unable to reverse geocode coordinates", {
        photonError,
        nominatimError,
        bigDataCloudError,
      });
      throw new ApiError("Unable to determine your location", 502);
    }
  }
}

export async function getCountries(): Promise<Country[]> {
  const cacheKey = "countries";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Country[];
  try {
    let countries: Country[] = [];

    try {
      const response = await fetch(
        `${countriesNowBaseUrl}/countries/iso`,
        {
          signal: AbortSignal.timeout(8_000),
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok)
        throw new Error(`Countries API returned ${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{ Iso2?: string; name?: string }>;
      };
      countries = (payload.data ?? [])
        .filter((country) => country.Iso2 && country.name)
        .map((country) => ({
          code: country.Iso2!,
          name: country.name!,
        }));
    } catch (primaryError) {
      console.warn("Primary country provider unavailable", primaryError);
      const response = await fetch(
        "https://countries.dev/countries?fields=name,alpha2Code&limit=300",
        {
          signal: AbortSignal.timeout(8_000),
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok)
        throw new Error(`Countries fallback returned ${response.status}`);
      const payload = (await response.json()) as Array<{
        alpha2Code?: string;
        name?: string;
      }>;
      countries = payload
        .filter((country) => country.alpha2Code && country.name)
        .map((country) => ({
          code: country.alpha2Code!,
          name: country.name!,
        }));
    }

    countries = countries.sort((a, b) => a.name.localeCompare(b.name));
    if (countries.length < 2) throw new Error("Country list is incomplete");
    cache.set(cacheKey, { expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, data: countries });
    return countries;
  } catch (error) {
    console.error("Unable to load countries", error);
    return [{ code: "ID", name: "Indonesia" }];
  }
}

export async function getCountryStates(country: string): Promise<Country[]> {
  const normalizedCountry = country.trim().slice(0, 120);
  const cacheKey = `worldwide-states:${normalizedCountry.toLocaleLowerCase("en")}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Country[];

  try {
    const params = new URLSearchParams({ country: normalizedCountry });
    const response = await fetch(
      `${countriesNowBaseUrl}/countries/states/q?${params.toString()}`,
      {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok)
      throw new Error(`Countries API returned ${response.status}`);
    const payload = (await response.json()) as {
      data?: { states?: Array<{ name?: string; state_code?: string }> };
    };
    const states = (payload.data?.states ?? [])
      .filter((state) => state.name)
      .map((state) => ({
        code: state.state_code || state.name!,
        name: state.name!,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    cache.set(cacheKey, {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      data: states,
    });
    return states;
  } catch (error) {
    console.error(`Unable to load states for ${normalizedCountry}`, error);
    throw new ApiError("State data is temporarily unavailable", 502);
  }
}

export async function getStateCities(
  country: string,
  state: string,
): Promise<Country[]> {
  const normalizedCountry = country.trim().slice(0, 120);
  const normalizedState = state.trim().slice(0, 120);
  const cacheKey = `worldwide-cities:${normalizedCountry.toLocaleLowerCase("en")}:${normalizedState.toLocaleLowerCase("en")}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Country[];

  if (normalizedCountry.toLocaleLowerCase("en") === "indonesia") {
    const canonicalState = normalizeIndonesianProvinceName(normalizedState)!;
    try {
      const provinces = (await getRegions("provinces.json")) as Array<{
        code?: string;
        name?: string;
      }>;
      const province = provinces.find(
        (item) =>
          item.name?.trim().toLocaleLowerCase("en") ===
          canonicalState.toLocaleLowerCase("en"),
      );
      if (!province?.code)
        throw new Error(`Unknown Indonesian province: ${normalizedState}`);

      const regencies = (await getRegions(
        `regencies/${province.code}.json`,
      )) as Array<{ code?: string; name?: string }>;
      const cities = regencies
        .filter(
          (regency): regency is { code: string; name: string } =>
            Boolean(regency.code && regency.name),
        )
        .map((regency) => ({ code: regency.code, name: regency.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      cache.set(cacheKey, {
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        data: cities,
      });
      return cities;
    } catch (error) {
      console.warn(
        `Unable to load Indonesian cities for ${canonicalState} from Wilayah.id`,
        error,
      );
    }
  }

  try {
    const providerState =
      normalizedCountry.toLocaleLowerCase("en") === "indonesia"
        ? normalizeIndonesianProvinceName(normalizedState)!
        : normalizedState;
    const params = new URLSearchParams({
      country: normalizedCountry,
      state: providerState,
    });
    const response = await fetch(
      `${countriesNowBaseUrl}/countries/state/cities/q?${params.toString()}`,
      {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok)
      throw new Error(`Countries API returned ${response.status}`);
    const payload = (await response.json()) as { data?: string[] };
    const cities = [...new Set(payload.data ?? [])]
      .filter(Boolean)
      .map((name) => ({ code: name, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    cache.set(cacheKey, {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      data: cities,
    });
    return cities;
  } catch (error) {
    console.error(
      `Unable to load cities for ${normalizedState}, ${normalizedCountry}`,
      error,
    );
    throw new ApiError("City data is temporarily unavailable", 502);
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
