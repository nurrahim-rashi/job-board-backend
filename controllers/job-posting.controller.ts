import { NextFunction, Request, Response } from "express";
import { getJobListService } from "../services/job-posting-management/job-posting-list.service.js";
import {
    createJobService,
    deleteJobService,
    getCompanyId,
    getJobDetailsService,
    togglePublishService,
    updateJobService,
} from "../services/job-posting-management/job-posting.service.js";
import { jobQuerySchema, PublishInput } from "../validators/job-posting.validator.js";

export const createJobController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await createJobService(userId, req.body);
    res.status(201).send(result);
  } catch (error) {
    next(error);
  }
};

export const getJobListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const query = jobQuerySchema.parse(req.query);
    const companyId = await getCompanyId(userId);

    const result = await getJobListService(companyId, query);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const getJobDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
    try {
        const result = await getJobDetailsService(req.job!)
        res.status(200).send(result)
    } catch (error) {
        next(error)
    }
};

export const updateJobController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
    try {
        const result = await updateJobService(req.job!, req.body)
        res.status(200).send(result)
    } catch (error) {
        next(error)
    }
}

export const togglePublishController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
    try {
        const { isPublished } = req.body as PublishInput;
        const result = await togglePublishService(req.job!, req.body.isPublished)
        res.status(200).json({
            success: true,
            message: isPublished ? "Job posting published successfully" : "Job posting saved as draft",
            data: result
        })
    } catch (error) {
        next(error)
    }
}

export const deleteJobController = async(
  req: Request,
  res: Response,
  next: NextFunction,  
) => {
    try {
        const result = await deleteJobService(req.job!)
        res.status(200).send(result)
    } catch (error) {
        next(error)
    }
}