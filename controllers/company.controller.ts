import type { Request, Response } from "express";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  getPublicCompanies,
  getPublicCompanyDetail,
} from "../services/company.service.js";
import { ApiError } from "../utils/api-error.js";

export async function listPublicCompaniesController(
  req: Request,
  res: Response,
) {
  const search =
    typeof req.query.search === "string" && req.query.search.trim()
      ? req.query.search.trim()
      : undefined;
  const city =
    typeof req.query.city === "string" && req.query.city.trim()
      ? req.query.city.trim()
      : undefined;
  const province =
    typeof req.query.province === "string" && /^\d{2}$/.test(req.query.province)
      ? req.query.province
      : undefined;
  if (typeof req.query.province === "string" && !province)
    throw new ApiError("Province is invalid", 400);
  const provinceName =
    typeof req.query.provinceName === "string" && req.query.provinceName.trim()
      ? req.query.provinceName.trim().slice(0, 120)
      : undefined;
  const country =
    typeof req.query.country === "string" && req.query.country.trim()
      ? req.query.country.trim().slice(0, 120)
      : undefined;
  const sort =
    req.query.sort === "desc"
      ? "desc"
      : req.query.sort === "nearest"
        ? "nearest"
        : "asc";
  const latitude =
    req.query.latitude === undefined ? undefined : Number(req.query.latitude);
  const longitude =
    req.query.longitude === undefined ? undefined : Number(req.query.longitude);
  if (
    (latitude === undefined) !== (longitude === undefined) ||
    (latitude !== undefined &&
      (!Number.isFinite(latitude) || !Number.isFinite(longitude)))
  )
    throw new ApiError(
      "Valid latitude and longitude must be provided together",
      400,
    );
  res
    .status(200)
    .json({
      data: await getPublicCompanies({
        search,
        province,
        provinceName,
        country,
        city,
        sort,
        latitude,
        longitude,
      }),
    });
}

export async function getPublicCompanyDetailController(
  req: Request,
  res: Response,
) {
  const id = Number(req.params.companyId);
  if (!Number.isInteger(id)) throw new ApiError("Company id is invalid", 400);
  res
    .status(200)
    .json({
      data: await getPublicCompanyDetail(
        id,
        (req as Partial<AuthenticatedRequest>).user?.id,
      ),
    });
}
