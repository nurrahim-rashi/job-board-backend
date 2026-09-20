import { ApiError } from "../utils/api-error.js";

export type ExchangeRateTable = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
};

type CachedTable = { expiresAt: number; table: ExchangeRateTable };

// Rates move slowly and every visitor of a job page asks for the same table,
// so one upstream call per hour is enough.
const CACHE_TTL = 60 * 60 * 1000;
let usdTable: CachedTable | null = null;
let inFlight: Promise<ExchangeRateTable> | null = null;

const isRateMap = (value: unknown): value is Record<string, number> =>
  !!value &&
  typeof value === "object" &&
  Object.values(value as Record<string, unknown>).every(
    (rate) => typeof rate === "number" && Number.isFinite(rate),
  );

async function fetchFromOpenErApi(): Promise<ExchangeRateTable> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`open.er-api returned ${response.status}`);
  const payload = (await response.json()) as {
    result?: string;
    rates?: unknown;
    time_last_update_utc?: string;
  };
  if (payload.result !== "success" || !isRateMap(payload.rates))
    throw new Error("open.er-api returned an unusable payload");
  return {
    base: "USD",
    rates: payload.rates,
    fetchedAt: payload.time_last_update_utc
      ? new Date(payload.time_last_update_utc).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchFromFrankfurter(): Promise<ExchangeRateTable> {
  const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`frankfurter returned ${response.status}`);
  const payload = (await response.json()) as { rates?: unknown; date?: string };
  if (!isRateMap(payload.rates))
    throw new Error("frankfurter returned an unusable payload");
  return {
    base: "USD",
    rates: { ...payload.rates, USD: 1 },
    fetchedAt: payload.date
      ? new Date(`${payload.date}T00:00:00Z`).toISOString()
      : new Date().toISOString(),
  };
}

async function loadUsdTable(): Promise<ExchangeRateTable> {
  const cached = usdTable;
  if (cached && cached.expiresAt > Date.now()) return cached.table;
  // Concurrent job pages should share one upstream call, not race it.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      let table: ExchangeRateTable;
      try {
        table = await fetchFromOpenErApi();
      } catch (error) {
        console.error("Primary exchange rate provider failed", error);
        table = await fetchFromFrankfurter();
      }
      usdTable = { expiresAt: Date.now() + CACHE_TTL, table };
      return table;
    } finally {
      inFlight = null;
    }
  })();

  try {
    return await inFlight;
  } catch (error) {
    console.error("Unable to load exchange rates", error);
    // A stale table beats no converter at all.
    if (cached) return cached.table;
    throw new ApiError("Exchange rates are unavailable right now", 503);
  }
}

/**
 * Rates are always fetched against USD and cross-divided from there. Asking the
 * upstream for a weak base such as IDR comes back with two significant digits
 * (1 IDR = 0.000056 USD), which is too coarse to convert a salary with.
 */
export async function getExchangeRates(base: string): Promise<ExchangeRateTable> {
  const code = base.trim().toUpperCase();
  const table = await loadUsdTable();
  if (code === "USD") return table;

  const baseRate = table.rates[code];
  if (!baseRate)
    throw new ApiError(`No exchange rate is published for ${code}`, 404);

  const rates: Record<string, number> = {};
  for (const [currency, rate] of Object.entries(table.rates))
    rates[currency] = rate / baseRate;

  return { base: code, rates, fetchedAt: table.fetchedAt };
}
