import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createAssessmentSchema, createAssessmentQuestionSchema } from "../validators/assessment.validator.js";
import { createAssessmentController, createAssessmentQuestionController } from "../controllers/assessment.controller.js";

export const assessmentRoutes = express.Router();

assessmentRoutes.post(
    "/",
    verifyToken(process.env.JWT_SECRET!),
    validate(createAssessmentSchema),
    createAssessmentController,
)

assessmentRoutes.post(
    "/:assessmentId/questions",
    verifyToken(process.env.JWT_SECRET!),
    validate(createAssessmentQuestionSchema),
    createAssessmentQuestionController,
)