import express from "express";
import { runInterviewReminderController } from "../controllers/cron.controller.js";
import { verifyCronRequest } from "../middlewares/cron.middleware.js";

export const cronRoutes = express.Router();

cronRoutes.get(
  "/interview-reminder",
  verifyCronRequest,
  runInterviewReminderController,
);
