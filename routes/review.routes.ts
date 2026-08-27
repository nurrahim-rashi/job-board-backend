import express from "express";
import { createReviewController } from "../controllers/review.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createReviewSchema } from "../validators/review.validator.js";

export const reviewRoutes = express.Router();

reviewRoutes.post(
  "/:companyId",
  verifyToken(process.env.JWT_SECRET!),
  validate(createReviewSchema),
  createReviewController,
);
