import express from "express";
import {
  createReviewController,
  getCompanyReviewsController,
  getReviewStoriesController,
} from "../controllers/review.controller.js";
import { verifyToken, optionalToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createReviewSchema } from "../validators/review.validator.js";

export const reviewRoutes = express.Router();

reviewRoutes.get("/stories", getReviewStoriesController);

reviewRoutes.get(
  "/:companyId",
  optionalToken(process.env.JWT_SECRET!),
  getCompanyReviewsController,
);

reviewRoutes.post(
  "/:companyId",
  verifyToken(process.env.JWT_SECRET!),
  validate(createReviewSchema),
  createReviewController,
);
