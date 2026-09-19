import type { NextFunction, Request, Response } from "express";
import { createApplication, getMyApplicationDetail, getMyApplicationForJob, getMyApplications, getMyApplicationsPage, submitRequestedExpectedSalary } from "../services/application.service.js";
import { ApiError } from "../utils/api-error.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { currencyCodeSchema } from "../utils/currency.js";

export async function createApplicationController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError("CV PDF is required", 400);
    const expectedSalary = req.body.expectedSalary ? Number(req.body.expectedSalary) : undefined;
    const expectedSalaryCurrency = currencyCodeSchema.parse(req.body.expectedSalaryCurrency ?? "IDR");
    if (expectedSalary !== undefined && (!Number.isInteger(expectedSalary) || expectedSalary <= 0)) throw new ApiError("Expected salary must be a positive number", 400);
    const data = await createApplication((req as AuthenticatedRequest).user.id, String(req.params.slug), req.file, expectedSalary, expectedSalaryCurrency);
    res.status(201).json({ message: "Application submitted successfully", data });
  } catch (error) { next(error); }
}

export async function listMyApplicationsController(req: Request, res: Response, next: NextFunction) {
  try { res.status(200).json({ data: await getMyApplications((req as AuthenticatedRequest).user.id) }); } catch (error) { next(error); }
}

export async function listMyApplicationsPageController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const view = req.query.view === "interviews" || req.query.view === "tests" || req.query.view === "closed" ? req.query.view : undefined;
    const allowedStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "ACCEPTED", "REJECTED"] as const;
    const requestedStatus = String(req.query.status ?? "");
    const status = allowedStatuses.find((item) => item === requestedStatus);
    res.status(200).json({ data: await getMyApplicationsPage((req as AuthenticatedRequest).user.id, page, limit, view, status) });
  } catch (error) { next(error); }
}

export async function getMyApplicationDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.applicationId);
    if (!Number.isInteger(id)) throw new ApiError("Application id is invalid", 400);
    res.status(200).json({ data: await getMyApplicationDetail((req as AuthenticatedRequest).user.id, id) });
  } catch (error) { next(error); }
}

export async function submitExpectedSalaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.applicationId);
    const expectedSalary = Number(req.body.expectedSalary);
    const expectedSalaryCurrency = currencyCodeSchema.parse(req.body.expectedSalaryCurrency ?? "IDR");
    if (!Number.isInteger(id) || id < 1) throw new ApiError("Application id is invalid", 400);
    if (!Number.isInteger(expectedSalary) || expectedSalary <= 0) throw new ApiError("Expected salary is required and must be a positive number", 400);
    const data = await submitRequestedExpectedSalary((req as AuthenticatedRequest).user.id, id, expectedSalary, expectedSalaryCurrency);
    res.status(200).json({ message: "Expected salary submitted successfully", data });
  } catch (error) { next(error); }
}

export async function getMyJobApplicationController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMyApplicationForJob(
      (req as AuthenticatedRequest).user.id,
      String(req.params.slug),
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
