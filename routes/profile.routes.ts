import express from "express";
import { getPublicProfileController } from "../controllers/profile.controller.js";
import { optionalToken } from "../middlewares/auth.middleware.js";

export const profileRoutes = express.Router();
profileRoutes.get(
  "/:userId",
  optionalToken(process.env.JWT_SECRET!),
  getPublicProfileController,
);
