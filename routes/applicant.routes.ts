import express from "express";
import {
  getApplicantCvController,
  getApplicantDetailController,
  getApplicantListController,
  updateApplicantStatusController,
} from "../controllers/applicant.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";
import { jobOwnership } from "../middlewares/job-ownership.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { updateStatusSchema } from "../validators/applicant.validator.js";

export const applicantRoutes = express.Router();

const verifyJobOwner = [
  verifyToken(process.env.JWT_SECRET!),
  verifyRole("COMPANY_ADMIN"),
  jobOwnership,
];

applicantRoutes.get(
  "/:slug/applicants",
  ...verifyJobOwner,
  getApplicantListController,
);

applicantRoutes.get(
  "/:slug/applicants/:applicationId",
  ...verifyJobOwner,
  getApplicantDetailController,
);

applicantRoutes.get(
  "/:slug/applicants/:applicationId/cv",
  ...verifyJobOwner,
  getApplicantCvController,
);

applicantRoutes.patch(
  "/:slug/applicants/:applicationId/status",
  ...verifyJobOwner,
  validate(updateStatusSchema),
  updateApplicantStatusController,
);
