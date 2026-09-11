import express from "express";
import { getPublicProfileController } from "../controllers/profile.controller.js";

export const profileRoutes = express.Router();
profileRoutes.get("/:userId", getPublicProfileController);
