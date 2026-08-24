import express from "express";
import {
  assignTestController,
  deleteTestController,
  getTestController,
  saveQuestionsController,
  setActivationController,
} from "../controllers/company-test.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/verifyRole.middleware.js";
import { jobOwnership } from "../middlewares/job-ownership.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  activationSchema,
  assignTestSchema,
  saveTestSchema,
} from "../validators/pre-selection-test.validator.js";
import { getTestResultController } from "../controllers/test-result.controller.js";

export const preSelectionTestRoutes = express.Router();

const verifyJobOwner = [
  verifyToken(process.env.JWT_SECRET!),
  verifyRole("COMPANY_ADMIN"),
  jobOwnership,
];

preSelectionTestRoutes.get(
  "/:slug/pre-selection-test",
  ...verifyJobOwner,
  getTestController,
);

preSelectionTestRoutes.put(
  "/:slug/pre-selection-test/questions",
  ...verifyJobOwner,
  validate(saveTestSchema),
  saveQuestionsController,
);

preSelectionTestRoutes.patch(
  "/:slug/pre-selection-test/activation",
  ...verifyJobOwner,
  validate(activationSchema),
  setActivationController,
);

preSelectionTestRoutes.delete(
  "/:slug/pre-selection-test",
  ...verifyJobOwner,
  deleteTestController,
);

preSelectionTestRoutes.patch(
  "/:slug/pre-selection-test/assign",
  ...verifyJobOwner,
  validate(assignTestSchema),
  assignTestController,
);

preSelectionTestRoutes.get(
  "/:slug/pre-selection-test/results/:applicationId",
  ...verifyJobOwner,
  getTestResultController,
);