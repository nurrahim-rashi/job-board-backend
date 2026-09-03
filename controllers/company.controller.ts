import type { Request, Response } from "express";
import { getPublicCompanies, getPublicCompanyDetail } from "../services/company.service.js";
import { ApiError } from "../utils/api-error.js";

export async function listPublicCompaniesController(req: Request, res: Response) {
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
  const city = typeof req.query.city === "string" && req.query.city.trim() ? req.query.city.trim() : undefined;
  const sort = req.query.sort === "desc" ? "desc" : "asc";
  res.status(200).json({ data: await getPublicCompanies({ search, city, sort }) });
}

export async function getPublicCompanyDetailController(req: Request, res: Response) {
  const id = Number(req.params.companyId);
  if (!Number.isInteger(id)) throw new ApiError("Company id is invalid", 400);
  res.status(200).json({ data: await getPublicCompanyDetail(id) });
}
