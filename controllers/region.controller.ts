import type { Request, Response } from "express";
import {
  getCountries,
  getCountryStates,
  getRegions,
  getStateCities,
  searchWorldwideLocations,
} from "../services/region.service.js";
import { ApiError } from "../utils/api-error.js";
import { getEducationOptions } from "../services/education.service.js";

export async function listProvincesController(_req: Request, res: Response) {
  res.status(200).json({ data: await getRegions("provinces.json") });
}

export async function listCountriesController(_req: Request, res: Response) {
  res.status(200).json({ data: await getCountries() });
}

export async function listStatesController(req: Request, res: Response) {
  const country =
    typeof req.query.country === "string" ? req.query.country.trim() : "";
  if (!country || country.length > 120)
    throw new ApiError("Country is required", 400);
  res.status(200).json({ data: await getCountryStates(country) });
}

export async function listCitiesController(req: Request, res: Response) {
  const country =
    typeof req.query.country === "string" ? req.query.country.trim() : "";
  const state =
    typeof req.query.state === "string" ? req.query.state.trim() : "";
  if (!country || country.length > 120 || !state || state.length > 120)
    throw new ApiError("Country and state are required", 400);
  res.status(200).json({ data: await getStateCities(country, state) });
}

export async function listRegenciesController(req: Request, res: Response) {
  const code = String(req.params.provinceCode);
  if (!/^\d{2}$/.test(code)) throw new ApiError("Province code is invalid", 400);
  res.status(200).json({ data: await getRegions(`regencies/${code}.json`) });
}

export async function searchLocationsController(req: Request, res: Response) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 80)
    throw new ApiError("Location search must be between 2 and 80 characters", 400);
  res.status(200).json({ data: await searchWorldwideLocations(query) });
}

export async function listEducationOptionsController(req: Request, res: Response) {
  const kind = String(req.params.kind);
  if (kind !== "degrees" && kind !== "majors" && kind !== "institutions")
    throw new ApiError("Education option type is invalid", 400);
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const country = typeof req.query.country === "string" ? req.query.country.trim().slice(0, 120) : undefined;
  res.status(200).json({ data: await getEducationOptions(kind, query, country) });
}
