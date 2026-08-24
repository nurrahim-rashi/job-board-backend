import { Response, Request } from "express";
import { 
  createAssessmentService, 
  createAssessmentQuestionService, 
} from "../services/assessment.service.js";

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

export const createAssessmentQuestionController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;
  const assessmentId = Number(req.params.assessmentId);

  const question = await createAssessmentQuestionService(
    userRole,
    assessmentId,
    req.body,
  );

  return res.status(201).json({
    message: "Assessment question created successfully",
    data: question,
  });
};