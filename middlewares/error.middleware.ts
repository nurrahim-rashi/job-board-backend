import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message =
    error instanceof ApiError ? error.message : "Internal server error";
  return res.status(statusCode).json({ message });
};
