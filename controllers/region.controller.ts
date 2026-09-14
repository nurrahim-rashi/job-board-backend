import type { Request, Response } from "express";
import { getRegions } from "../services/region.service.js";
import { ApiError } from "../utils/api-error.js";

export async function listProvincesController(_req: Request, res: Response) {
  res.status(200).json({ data: await getRegions("provinces.json") });
}

export async function listRegenciesController(req: Request, res: Response) {
  const code = String(req.params.provinceCode);
  if (!/^\d{2}$/.test(code)) throw new ApiError("Province code is invalid", 400);
  res.status(200).json({ data: await getRegions(`regencies/${code}.json`) });
}
