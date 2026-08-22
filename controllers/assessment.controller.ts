import { Response, Request } from "express";
import { createAssessmentService } from "../services/assessment.service.js";

export const createAssessmentController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;

  const assessment = await createAssessmentService(userRole, req.body);

  return res.status(201).json({
    message: "Assessment created successfully",
    data: assessment,
  });
};
