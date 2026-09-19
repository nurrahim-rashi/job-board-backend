import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";
import multer from "multer";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  console.error(`[${req.method}] ${req.originalUrl}`, error);
  const statusCode = error instanceof ApiError || error instanceof multer.MulterError
    ? error instanceof ApiError ? error.statusCode : 400
    : 500;
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof multer.MulterError
        ? error.code === "LIMIT_FILE_SIZE" ? "Image file is too large" : error.message
        : "Internal server error";
  return res.status(statusCode).json({ message });
};
