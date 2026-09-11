import { NextFunction, Request, Response } from "express";
import {
  createInterviewsService,
  deleteInterviewService,
  getInterviewDetailService,
  getInterviewListService,
  updateInterviewService,
} from "../services/interview-management/interview.service.js";
import { ApiError } from "../utils/api-error.js";
import {
  CreateInterviewInput,
  interviewQuerySchema,
  UpdateInterviewInput,
} from "../validators/interview.validator.js";

const getInterviewId = (value: unknown) => {
  const interviewId = Number(value);

  if (!Number.isInteger(interviewId) || interviewId < 1) {
    throw new ApiError("Interview schedule not found", 404);
  }

  return interviewId;
};

const emailNotice = (notified: boolean) =>
  notified ? "" : " Some notification emails could not be delivered.";

export const createInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = req.body as CreateInterviewInput;
    const result = await createInterviewsService(req.job!, data);

    res.status(201).json({
      message: `${result.data.length} interview schedule(s) created.${emailNotice(result.notified)}`,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getInterviewListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = interviewQuerySchema.parse(req.query);
    const result = await getInterviewListService(req.job!, query);
    res.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const getInterviewDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const interviewId = getInterviewId(req.params.interviewId);
    const result = await getInterviewDetailService(req.job!, interviewId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const updateInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const interviewId = getInterviewId(req.params.interviewId);
    const data = req.body as UpdateInterviewInput;
    const result = await updateInterviewService(req.job!, interviewId, data);

    res.status(200).json({
      message: `Interview schedule updated.${emailNotice(result.notified)}`,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const interviewId = getInterviewId(req.params.interviewId);
    const result = await deleteInterviewService(req.job!, interviewId);

    res.status(200).json({
      message: `Interview schedule deleted.${emailNotice(result.notified)}`,
    });
  } catch (error) {
    next(error);
  }
};
