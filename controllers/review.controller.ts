import { Response, Request } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  createReviewService,
  getCompanyReviewsService,
  getReviewStoriesService,
} from "../services/review.service.js";
import { parsePositiveIntId } from "../utils/parse-id.js";

function getCompanyId(req: Request) {
  return parsePositiveIntId(String(req.params.companyId), "Company id");
}

export const getReviewStoriesController = async (
  _req: Request,
  res: Response,
) => {
  return res.status(200).json({
    data: await getReviewStoriesService(),
  });
};

export const getCompanyReviewsController = async (
  req: Request,
  res: Response,
) => {
  const companyId = getCompanyId(req);
  const user = (req as AuthenticatedRequest).user;

  return res.status(200).json({
    data: await getCompanyReviewsService(companyId, user?.id),
  });
};

export const createReviewController = async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const user = (req as AuthenticatedRequest).user;

  const review = await createReviewService(user.id, companyId, req.body);

  return res.status(201).json({
    message: "Company review created successfully",
    data: review,
  });
};
