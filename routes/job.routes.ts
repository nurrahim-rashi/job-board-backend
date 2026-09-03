import express from "express";
import { getPublicJobDetailController, listPublicJobsController } from "../controllers/job.controller.js";

export const jobRoutes = express.Router();

jobRoutes.get("/", listPublicJobsController);
jobRoutes.get("/:slug", getPublicJobDetailController);
