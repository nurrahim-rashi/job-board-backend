import type { Request, Response } from "express";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { followCompany, getFollowedCompanies, getPublicCompanies, getPublicCompanyDetail, unfollowCompany } from "../services/company.service.js";
import { ApiError } from "../utils/api-error.js";

export async function listPublicCompaniesController(req: Request, res: Response) {
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
  const city = typeof req.query.city === "string" && req.query.city.trim() ? req.query.city.trim() : undefined;
  const sort = req.query.sort === "desc" ? "desc" : req.query.sort === "nearest" ? "nearest" : "asc";
  const latitude = req.query.latitude === undefined ? undefined : Number(req.query.latitude);
  const longitude = req.query.longitude === undefined ? undefined : Number(req.query.longitude);
  if ((latitude === undefined) !== (longitude === undefined) || (latitude !== undefined && (!Number.isFinite(latitude) || !Number.isFinite(longitude)))) throw new ApiError("Valid latitude and longitude must be provided together", 400);
  res.status(200).json({ data: await getPublicCompanies({ search, city, sort, latitude, longitude }) });
}

export async function getPublicCompanyDetailController(req: Request, res: Response) {
  const id = Number(req.params.companyId);
  if (!Number.isInteger(id)) throw new ApiError("Company id is invalid", 400);
  res.status(200).json({ data: await getPublicCompanyDetail(id) });
}

const userId = (req: Request) => (req as AuthenticatedRequest).user.id;
const companyId = (req: Request) => {
  const id = Number(req.params.companyId);
  if (!Number.isInteger(id)) throw new ApiError("Company id is invalid", 400);
  return id;
};

export async function listFollowedCompaniesController(req: Request, res: Response) {
  res.status(200).json({ data: await getFollowedCompanies(userId(req)) });
}

export async function followCompanyController(req: Request, res: Response) {
  await followCompany(userId(req), companyId(req));
  res.status(200).json({ message: "Company followed" });
}

export async function unfollowCompanyController(req: Request, res: Response) {
  await unfollowCompany(userId(req), companyId(req));
  res.status(200).json({ message: "Company unfollowed" });
}
