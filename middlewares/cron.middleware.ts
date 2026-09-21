import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

export const verifyCronRequest: RequestHandler = (req, _res, next) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    next(new ApiError("Scheduled jobs are not configured", 503));
    return;
  }

  if (req.headers.authorization !== `Bearer ${secret}`) {
    next(new ApiError("Not authorised", 401));
    return;
  }

  next();
};
