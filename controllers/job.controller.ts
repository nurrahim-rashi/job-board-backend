import type { Request, Response } from "express";
import { getPublicJobs } from "../services/job.service.js";
import { ApiError } from "../utils/api-error.js";

function parseCoordinate(value: unknown, name: string) {
  if (value === undefined) return undefined;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) throw new ApiError(`${name} must be a valid number`, 400);
  return coordinate;
}

export async function listPublicJobsController(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
  const latitude = parseCoordinate(req.query.latitude, "latitude");
  const longitude = parseCoordinate(req.query.longitude, "longitude");
  if ((latitude === undefined) !== (longitude === undefined)) throw new ApiError("latitude and longitude must be provided together", 400);
  const city = typeof req.query.city === "string" && req.query.city.trim() ? req.query.city.trim() : undefined;
  return res.status(200).json({ data: await getPublicJobs({ latitude, longitude, city, limit }) });
}
