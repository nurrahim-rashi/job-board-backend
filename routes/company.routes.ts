import express from "express";
import { followCompanyController, getPublicCompanyDetailController, listFollowedCompaniesController, listPublicCompaniesController, unfollowCompanyController } from "../controllers/company.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";

export const companyRoutes = express.Router();
const jobSeeker = [verifyToken(process.env.JWT_SECRET!), verifyRole("JOB_SEEKER")];

companyRoutes.get("/followed/me", ...jobSeeker, listFollowedCompaniesController);
companyRoutes.post("/:companyId/follow", ...jobSeeker, followCompanyController);
companyRoutes.delete("/:companyId/follow", ...jobSeeker, unfollowCompanyController);
companyRoutes.get("/", listPublicCompaniesController);
companyRoutes.get("/:companyId", getPublicCompanyDetailController);
