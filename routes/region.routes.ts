import express from "express";
import { listCountriesController, listProvincesController, listRegenciesController } from "../controllers/region.controller.js";

export const regionRoutes = express.Router();
regionRoutes.get("/countries", listCountriesController);
regionRoutes.get("/provinces", listProvincesController);
regionRoutes.get("/regencies/:provinceCode", listRegenciesController);
