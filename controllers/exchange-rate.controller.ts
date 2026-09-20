import type { Request, Response } from "express";
import { getExchangeRates } from "../services/exchange-rate.service.js";
import { ApiError } from "../utils/api-error.js";

export async function exchangeRatesController(req: Request, res: Response) {
  const base = typeof req.query.base === "string" ? req.query.base.trim() : "";
  if (!/^[A-Za-z]{3}$/.test(base))
    throw new ApiError("Base must be a three letter currency code", 400);

  const table = await getExchangeRates(base);
  res.status(200).json({ data: table });
}
