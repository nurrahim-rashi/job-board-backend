import express from "express";
import { exchangeRatesController } from "../controllers/exchange-rate.controller.js";

export const exchangeRateRoutes = express.Router();
exchangeRateRoutes.get("/", exchangeRatesController);
