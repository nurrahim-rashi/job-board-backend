import express from "express";
import {
  listMySavedJobIdsController,
  listMySavedJobsController,
  saveJobController,
  unsaveJobController,
} from "../controllers/saved-job.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";

export const savedJobRoutes = express.Router();

const seeker = [
  verifyToken(process.env.JWT_SECRET!),
  verifyRole("JOB_SEEKER"),
];

savedJobRoutes.post("/jobs/:slug/save", ...seeker, saveJobController);
savedJobRoutes.delete("/jobs/:slug/save", ...seeker, unsaveJobController);
savedJobRoutes.get("/saved-jobs", ...seeker, listMySavedJobsController);
savedJobRoutes.get("/saved-jobs/ids", ...seeker, listMySavedJobIdsController);
