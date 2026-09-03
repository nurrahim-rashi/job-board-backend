import express from "express";
import { getPublicCompanyDetailController, listPublicCompaniesController } from "../controllers/company.controller.js";

export const companyRoutes = express.Router();
companyRoutes.get("/", listPublicCompaniesController);
companyRoutes.get("/:companyId", getPublicCompanyDetailController);
