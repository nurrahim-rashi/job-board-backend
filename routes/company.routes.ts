import express from "express";
import { getPublicCompanyDetailController, listPublicCompaniesController } from "../controllers/company.controller.js";
import { optionalToken } from "../middlewares/auth.middleware.js";

export const companyRoutes = express.Router();
companyRoutes.get("/", listPublicCompaniesController);
companyRoutes.get("/:companyId", optionalToken(process.env.JWT_SECRET!), getPublicCompanyDetailController);
