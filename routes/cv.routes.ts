import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { generateCvSchema } from "../validators/cv.validator.js";
import { generateCvController } from "../controllers/cv.controller.js";

export const cvRoutes = express.Router();

cvRoutes.post(
  "/generate",
  verifyToken(process.env.JWT_SECRET!),
  validate(generateCvSchema),
  generateCvController,
);
