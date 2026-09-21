import type { NextFunction, Request, Response } from "express";
import { getAnalyticsOverviewService } from "../services/analytics/analytics-overview.service.js";
import { getApplicantInterestsService } from "../services/analytics/applicant-interests.service.js";
import { getPlatformEngagementService } from "../services/analytics/platform-engagement.service.js";
import { getSalaryTrendsService } from "../services/analytics/salary-trends.service.js";
import { getUserDemographicsService } from "../services/analytics/user-demographics.service.js";
import { parseQuery } from "../middlewares/validation.middleware.js";
import { analyticsQuerySchema } from "../validators/analytics.validator.js";
import { getCompanyId } from "../services/job-posting-management/job-posting.service.js";

const scopeFor = async (req: Request) =>
  req.user!.role === "COMPANY_ADMIN" ? getCompanyId(req.user!.id) : undefined;

export const getAnalyticsOverviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = parseQuery(analyticsQuerySchema, req.query);
    const result = await getAnalyticsOverviewService(query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getUserDemographicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = parseQuery(analyticsQuerySchema, req.query);
    const result = await getUserDemographicsService(query, await scopeFor(req));
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getSalaryTrendsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = parseQuery(analyticsQuerySchema, req.query);
    const result = await getSalaryTrendsService(query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getApplicantInterestsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = parseQuery(analyticsQuerySchema, req.query);
    const result = await getApplicantInterestsService(query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getPlatformEngagementController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = parseQuery(analyticsQuerySchema, req.query);
    const result = await getPlatformEngagementService(query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
