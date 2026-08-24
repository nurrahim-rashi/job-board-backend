import express from 'express'
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/verifyRole.middleware.js';
import { jobOwnership } from '../middlewares/job-ownership.middleware.js';
import { applicationOwnership } from '../middlewares/application-ownership.middleware.js';
import { startTestController } from '../controllers/start-test.controller.js';
import { saveAnswerSchema } from '../validators/pre-selection-test.validator.js';
import { validate } from '../middlewares/validation.middleware.js';
import { saveAnswerController, submitTestController } from '../controllers/applicant-test.controller.js';

export const applicantTestRoutes = express.Router();

const verifyApplicant = [
    verifyToken(process.env.JWT_SECRET!),
    verifyRole("JOB_SEEKER"),
    applicationOwnership
]

applicantTestRoutes.post(
    "/:slug/pre-selection-test/start",
    ...verifyApplicant,
    startTestController
)

applicantTestRoutes.post(
  "/:slug/pre-selection-test/answers",
  ...verifyApplicant,
  validate(saveAnswerSchema),
  saveAnswerController,
);

applicantTestRoutes.post(
  "/:slug/pre-selection-test/submit",
  ...verifyApplicant,
  submitTestController,
);