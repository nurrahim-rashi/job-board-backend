import type { NextFunction, Request, Response } from "express";
import {
  deleteTestService,
  getTestService,
  saveQuestionsService,
  setActivationService,
} from "../services/pre-selection-test/company-test.service.js";
import {
  ActivationInput,
  AssignTestInput,
} from "../validators/pre-selection-test.validator.js";
import { assignTestService } from "../services/pre-selection-test/assign-test.service.js";

export const getTestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = req.job!;
    const result = await getTestService(job);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const saveQuestionsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const jobId = req.job!.id as number;
    const data = req.body;
    const result = await saveQuestionsService(jobId, data);
    res.status(200).json({ message: "Test questions saved successfully", data: result });
  } catch (error) {
    next(error);
  }
};

export const setActivationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = req.job!;
    const data = req.body as ActivationInput;
    const result = await setActivationService(job, data);
    res.status(200).json({
      message: data.hasPreSelectionTest ? "Pre-selection test activated" : "Pre-selection test deactivated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const jobId = req.job!.id as number;
    const result = await deleteTestService(jobId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const assignTestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await assignTestService(
      req.job!,
      req.body as AssignTestInput,
    );
    res.status(200).send(result)
  } catch (error) {
    next(error);
  }
};
