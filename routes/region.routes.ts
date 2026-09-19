import express from "express";
import {
  listCountriesController,
  listCitiesController,
  listProvincesController,
  listRegenciesController,
  listStatesController,
  searchLocationsController,
  listEducationOptionsController,
  reverseLocationController,
} from "../controllers/region.controller.js";

export const regionRoutes = express.Router();
regionRoutes.get("/countries", listCountriesController);
regionRoutes.get("/states", listStatesController);
regionRoutes.get("/cities", listCitiesController);
regionRoutes.get("/provinces", listProvincesController);
regionRoutes.get("/search", searchLocationsController);
regionRoutes.get("/reverse", reverseLocationController);
regionRoutes.get("/education/:kind", listEducationOptionsController);
regionRoutes.get("/regencies/:provinceCode", listRegenciesController);
