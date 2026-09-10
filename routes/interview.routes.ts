import express from "express";
import {
  createInterviewsController,
  deleteInterviewController,
  getInterviewDetailController,
  getInterviewListController,
  updateInterviewController,
} from "../controllers/interview.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";
import { jobOwnership } from "../middlewares/job-ownership.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createInterviewSchema,
  updateInterviewSchema,
} from "../validators/interview.validator.js";

export const interviewRoutes = express.Router();

const verifyJobOwner = [
  verifyToken(process.env.JWT_SECRET!),
  verifyRole("COMPANY_ADMIN"),
  jobOwnership,
];

interviewRoutes.post(
  "/:slug/interviews",
  ...verifyJobOwner,
  validate(createInterviewSchema),
  createInterviewsController,
);

interviewRoutes.get(
  "/:slug/interviews",
  ...verifyJobOwner,
  getInterviewListController,
);

interviewRoutes.get(
  "/:slug/interviews/:interviewId",
  ...verifyJobOwner,
  getInterviewDetailController,
);

interviewRoutes.patch(
  "/:slug/interviews/:interviewId",
  ...verifyJobOwner,
  validate(updateInterviewSchema),
  updateInterviewController,
);

interviewRoutes.delete(
  "/:slug/interviews/:interviewId",
  ...verifyJobOwner,
  deleteInterviewController,
);
