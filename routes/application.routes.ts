import express from "express";
import multer from "multer";
import { createApplicationController, getMyApplicationDetailController, getMyJobApplicationController, listMyApplicationsController } from "../controllers/application.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";

export const applicationRoutes = express.Router();
const upload = multer({ dest: "uploads/cvs/", limits: { fileSize: 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, file.mimetype === "application/pdf") });
const applicant = [verifyToken(process.env.JWT_SECRET!), verifyRole("JOB_SEEKER")];

applicationRoutes.post("/jobs/:slug/applications", ...applicant, upload.single("cv"), createApplicationController);
applicationRoutes.get("/jobs/:slug/application", ...applicant, getMyJobApplicationController);
applicationRoutes.get("/applications/me", ...applicant, listMyApplicationsController);
applicationRoutes.get("/applications/me/:applicationId", ...applicant, getMyApplicationDetailController);
