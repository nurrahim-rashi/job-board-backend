import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createAssessmentSchema,
  createAssessmentQuestionSchema,
  updateAssessmentQuestionSchema,
  submitAssessmentSchema,
} from "../validators/assessment.validator.js";
import {
  createAssessmentController,
  createAssessmentQuestionController,
  getAssessmentQuestionsController,
  updateAssessmentQuestionController,
  deleteAssessmentQuestionController,
  getAvailableAssessmentsController,
  getAssessmentDiscoveryDetailController,
  startAssessmentController,
  submitAssessmentController,
  getUserBadgesController,
  getUserAssessmentResultsController,
  getUserAssessmentResultDetailController,
} from "../controllers/assessment.controller.js";

export const assessmentRoutes = express.Router();

assessmentRoutes.post(
  "/",
  verifyToken(process.env.JWT_SECRET!),
  validate(createAssessmentSchema),
  createAssessmentController,
);

assessmentRoutes.get(
  "/badges",
  verifyToken(process.env.JWT_SECRET!),
  getUserBadgesController,
);

assessmentRoutes.get(
  "/results",
  verifyToken(process.env.JWT_SECRET!),
  getUserAssessmentResultsController,
);

assessmentRoutes.get(
  "/results/:resultId",
  verifyToken(process.env.JWT_SECRET!),
  getUserAssessmentResultDetailController,
);

assessmentRoutes.post(
  "/:assessmentId/start",
  verifyToken(process.env.JWT_SECRET!),
  startAssessmentController,
);

assessmentRoutes.post(
  "/:assessmentId/questions",
  verifyToken(process.env.JWT_SECRET!),
  validate(createAssessmentQuestionSchema),
  createAssessmentQuestionController,
);

assessmentRoutes.post(
  "/:assessmentId/submit",
  verifyToken(process.env.JWT_SECRET!),
  validate(submitAssessmentSchema),
  submitAssessmentController,
);

assessmentRoutes.get(
  "/:assessmentId/questions",
  verifyToken(process.env.JWT_SECRET!),
  getAssessmentQuestionsController,
);

assessmentRoutes.patch(
  "/:assessmentId/questions/:questionId",
  verifyToken(process.env.JWT_SECRET!),
  validate(updateAssessmentQuestionSchema),
  updateAssessmentQuestionController,
);

assessmentRoutes.delete(
  "/:assessmentId/questions/:questionId",
  verifyToken(process.env.JWT_SECRET!),
  deleteAssessmentQuestionController,
);

assessmentRoutes.get(
  "/discovery",
  verifyToken(process.env.JWT_SECRET!),
  getAvailableAssessmentsController,
);

assessmentRoutes.get(
  "/discovery/:assessmentId",
  verifyToken(process.env.JWT_SECRET!),
  getAssessmentDiscoveryDetailController,
);
