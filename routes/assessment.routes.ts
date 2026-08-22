import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createAssessmentSchema } from "../validators/assessment.validator.js";
import { createAssessmentController } from "../controllers/assessment.controller.js";

export const assessmentRoutes = express.Router();

assessmentRoutes.post(
    "/",
    verifyToken(process.env.JWT_SECRET!),
    validate(createAssessmentSchema),
    createAssessmentController,
)