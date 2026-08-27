import express from "express";
import { listPublicJobsController } from "../controllers/job.controller.js";

export const jobRoutes = express.Router();

jobRoutes.get("/", listPublicJobsController);
