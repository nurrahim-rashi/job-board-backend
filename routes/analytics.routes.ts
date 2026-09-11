import express from "express";
import {
  getAnalyticsOverviewController,
  getApplicantInterestsController,
  getPlatformEngagementController,
  getSalaryTrendsController,
  getUserDemographicsController,
} from "../controllers/analytics.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";

export const analyticsRoutes = express.Router();

const verifyAnalyticsAccess = [
  verifyToken(process.env.JWT_SECRET!),
  verifyRole("COMPANY_ADMIN", "DEVELOPER"),
];

analyticsRoutes.get(
  "/overview",
  ...verifyAnalyticsAccess,
  getAnalyticsOverviewController,
);

analyticsRoutes.get(
  "/demographics",
  ...verifyAnalyticsAccess,
  getUserDemographicsController,
);

analyticsRoutes.get(
  "/salary-trends",
  ...verifyAnalyticsAccess,
  getSalaryTrendsController,
);

analyticsRoutes.get(
  "/interests",
  ...verifyAnalyticsAccess,
  getApplicantInterestsController,
);

analyticsRoutes.get(
  "/engagement",
  ...verifyAnalyticsAccess,
  getPlatformEngagementController,
);
