import express from "express";
import { listProvincesController, listRegenciesController } from "../controllers/region.controller.js";

export const regionRoutes = express.Router();
regionRoutes.get("/provinces", listProvincesController);
regionRoutes.get("/regencies/:provinceCode", listRegenciesController);
