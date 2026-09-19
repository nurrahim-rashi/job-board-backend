import type { Request, Response } from "express";
import { JobCategory } from "../generated/prisma/client.js";
import { getPublicJobDetail, getPublicJobs } from "../services/job.service.js";
import { ApiError } from "../utils/api-error.js";

function parseCoordinate(value: unknown, name: string) {
  if (value === undefined) return undefined;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate))
    throw new ApiError(`${name} must be a valid number`, 400);
  return coordinate;
}

export async function listPublicJobsController(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const latitude = parseCoordinate(req.query.latitude, "latitude");
  const longitude = parseCoordinate(req.query.longitude, "longitude");
  if ((latitude === undefined) !== (longitude === undefined))
    throw new ApiError("latitude and longitude must be provided together", 400);
  const city =
    typeof req.query.city === "string" && req.query.city.trim()
      ? req.query.city.trim()
      : undefined;
  const province =
    typeof req.query.province === "string" && /^\d{2}$/.test(req.query.province)
      ? req.query.province
      : undefined;
  if (typeof req.query.province === "string" && !province)
    throw new ApiError("province is invalid", 400);
  const provinceName =
    typeof req.query.provinceName === "string" && req.query.provinceName.trim()
      ? req.query.provinceName.trim().slice(0, 120)
      : undefined;
  const country =
    typeof req.query.country === "string" && req.query.country.trim()
      ? req.query.country.trim().slice(0, 120)
      : undefined;
  const title =
    typeof req.query.title === "string" && req.query.title.trim()
      ? req.query.title.trim()
      : undefined;
  const category =
    typeof req.query.category === "string" &&
    Object.values(JobCategory).includes(req.query.category as JobCategory)
      ? (req.query.category as JobCategory)
      : undefined;
  if (typeof req.query.category === "string" && !category)
    throw new ApiError("category is invalid", 400);
  const sort = ["newest", "oldest", "nearest"].includes(String(req.query.sort))
    ? (req.query.sort as "newest" | "oldest" | "nearest")
    : "newest";
  const dateFrom = req.query.dateFrom
    ? new Date(String(req.query.dateFrom))
    : undefined;
  const dateTo = req.query.dateTo
    ? new Date(`${String(req.query.dateTo)}T23:59:59.999Z`)
    : undefined;
  if (
    (dateFrom && Number.isNaN(dateFrom.getTime())) ||
    (dateTo && Number.isNaN(dateTo.getTime()))
  )
    throw new ApiError("date range is invalid", 400);
  return res
    .status(200)
    .json({
      data: await getPublicJobs({
        latitude,
        longitude,
        province,
        provinceName,
        country,
        city,
        title,
        category,
        dateFrom,
        dateTo,
        sort,
        limit,
      }),
    });
}

export async function getPublicJobDetailController(
  req: Request,
  res: Response,
) {
  return res
    .status(200)
    .json({ data: await getPublicJobDetail(String(req.params.slug)) });
}
