import { NextFunction, Request, Response } from "express";
import {
  getApplicantCvService,
  getApplicantDetailService,
  requestExpectedSalaryService,
} from "../services/applicant-management/applicant-detail.service.js";
import { getApplicantListService } from "../services/applicant-management/applicant-list.service.js";
import { updateApplicantStatusService } from "../services/applicant-management/applicant-status.service.js";
import axios from "axios";
import type { Readable } from "node:stream";
import { ApiError } from "../utils/api-error.js";
import {
  applicantQuerySchema,
  UpdateStatusInput,
} from "../validators/applicant.validator.js";

const getApplicationId = (value: unknown) => {
  const applicationId = Number(value);

  if (!Number.isInteger(applicationId) || applicationId < 1) {
    throw new ApiError("Applicant not found", 404);
  }

  return applicationId;
};

export const requestExpectedSalaryController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = getApplicationId(req.params.applicationId);
    const data = await requestExpectedSalaryService(req.job!, applicationId);
    res.status(200).json({ message: "Expected salary request sent to applicant", data });
  } catch (error) { next(error); }
};

export const getApplicantListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = applicantQuerySchema.parse(req.query);
    const result = await getApplicantListService(req.job!.id, query);
    res.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const getApplicantDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const applicationId = getApplicationId(req.params.applicationId);
    const result = await getApplicantDetailService(req.job!, applicationId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getApplicantCvController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const applicationId = getApplicationId(req.params.applicationId);
    const cv = await getApplicantCvService(req.job!.id, applicationId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${cv.fileName}"`,
    );

    if (cv.source.kind === "file") {
      res.sendFile(cv.source.path, (error) => {
        if (error) next(error);
      });
      return;
    }

    // The stored provider URL stays on the server; only the bytes are relayed,
    // and only to a caller that already passed the job-owner check.
    const document = await axios.get<Readable>(cv.source.url, {
      responseType: "stream",
      timeout: 30_000,
    });
    document.data.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const updateApplicantStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const applicationId = getApplicationId(req.params.applicationId);
    const data = req.body as UpdateStatusInput;
    const result = await updateApplicantStatusService(
      req.job!,
      applicationId,
      data,
    );
    res.status(200).json({
      message: `Applicant status updated to ${data.status}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
