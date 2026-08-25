import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import { getTestResultService } from "../services/pre-selection-test/test-result.service.js";

export const getTestResultController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appId = Number(req.params.applicationId);

    if (!Number.isInteger(appId) || appId < 1) {
      throw new ApiError("Invalid applicationId", 404);
    }

    const result = await getTestResultService(req.job!, appId)
    res.status(200).send(result)
  } catch (error) {
    next(error)
  }
};
