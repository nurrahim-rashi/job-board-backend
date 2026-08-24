import { Response, Request } from "express";
import {
  createAssessmentService,
  createAssessmentQuestionService,
  getAssessmentQuestionsService,
  updateAssessmentQuestionService,
  deleteAssessmentQuestionService,
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

export const getAssessmentQuestionsController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;
  const assessmentId = Number(req.params.assessmentId);

  const questions = await getAssessmentQuestionsService(userRole, assessmentId);

  return res.status(200).json({
    message: "Assessment questions retrieved successfully",
    data: questions,
  });
};

export const updateAssessmentQuestionController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;
  const assessmentId = Number(req.params.assessmentId);
  const questionId = Number(req.params.questionId);

  const question = await updateAssessmentQuestionService(
    userRole,
    assessmentId,
    questionId,
    req.body,
  );

  return res.status(200).json({
    message: "Assessment question updated successfully",
    data: question,
  });
};

export const deleteAssessmentQuestionController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;
  const assessmentId = Number(req.params.assessmentId);
  const questionId = Number(req.params.questionId);

  const result = await deleteAssessmentQuestionService(
    userRole,
    assessmentId,
    questionId,
  );

  return res.status(200).json(result);
};
