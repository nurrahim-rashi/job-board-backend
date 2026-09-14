import { Response, Request } from "express";
import {
  createAssessmentService,
  createAssessmentQuestionService,
  getAssessmentQuestionsService,
  updateAssessmentQuestionService,
  deleteAssessmentQuestionService,
  getAvailableAssessmentService,
  getAssessmentDiscoveryDetailService,
  startAssessmentService,
  submitAssessmentService,
  getUserBadgesService,
  getUserAssessmentResultsService,
  getUserAssessmentResultDetailService,
  generateAssessmentCertificateService,
  getDeveloperAssessmentsService,
  getPublicSkillNamesService,
} from "../services/assessment.service.js";

export const getPublicSkillNamesController = async (_req: Request, res: Response) =>
  res.status(200).json({ data: await getPublicSkillNamesService() });

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

export const getAvailableAssessmentsController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;

  const assessments = await getAvailableAssessmentService(userId);

  return res.status(200).json({
    message: "Available assessments retrieved successfully",
    data: assessments,
  });
};

export const getAssessmentDiscoveryDetailController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;

  const assessmentId = Number(req.params.assessmentId);

  const assessment = await getAssessmentDiscoveryDetailService(
    userId,
    assessmentId,
  );

  return res.status(200).json({
    message: "Assessment detail retrieved successfully",
    data: assessment,
  });
};

export const startAssessmentController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const assessmentId = Number(req.params.assessmentId);

  const result = await startAssessmentService(userId, assessmentId);

  return res.status(201).json({
    message: "Assessment started successfully",
    data: result,
  });
};

export const submitAssessmentController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const assessmentId = Number(req.params.assessmentId);

  const { resultId, answers } = req.body;

  const result = await submitAssessmentService(
    userId,
    assessmentId,
    resultId,
    answers,
  );

  return res.status(200).json({
    message: "Assessment submitted successfully",
    data: result,
  });
};

export const getUserBadgesController = async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const badges = await getUserBadgesService(userId);

  return res.status(200).json({
    message: "User badges retrieved successfully",
    data: badges,
  });
};

export const getUserAssessmentResultsController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;

  const results = await getUserAssessmentResultsService(userId);

  return res.status(200).json({
    message: "Assessment results retrieved successfully",
    data: results,
  });
};

export const getUserAssessmentResultDetailController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const resultId = Number(req.params.resultId);

  const result = await getUserAssessmentResultDetailService(userId, resultId);

  return res.status(200).json({
    message: "Assessment result detail retrieved successfully",
    data: result,
  });
};

export const generateAssessmentCertificateController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const resultId = Number(req.params.resultId);

  const certificate = await generateAssessmentCertificateService(
    userId,
    resultId,
  );

  return res.status(200).json({
    message: "Assessment certificate generated successfully",
    data: certificate,
  });
};

export const getDeveloperAssessmentsController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;

  const assessments = await getDeveloperAssessmentsService(userRole);

  return res.status(200).json({
    message: "Developer assessments retrieved successfully",
    data: assessments,
  });
};
