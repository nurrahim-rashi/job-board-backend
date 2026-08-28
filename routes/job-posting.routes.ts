import express from 'express'
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from "../middlewares/auth.middleware.js";
import { jobOwnership } from '../middlewares/job-ownership.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { createJobSchema, publishSchema, updateJobSchema } from '../validators/job-posting.validator.js';
import { createJobController, deleteJobController, getJobDetailController, getJobListController, togglePublishController, updateJobController } from '../controllers/job-posting.controller.js';

export const jobPostingRoutes = express.Router();

const adminOnly = [
    verifyToken(process.env.JWT_SECRET!),
    verifyRole("COMPANY_ADMIN")
]

const adminWithJob = [...adminOnly, jobOwnership]

const uploadBanner = upload().single("banner")

jobPostingRoutes.post(
    "/",
    ...adminOnly,
    uploadBanner,
    validate(createJobSchema),
    createJobController
)

jobPostingRoutes.get(
    "/",
    ...adminOnly,
    getJobListController
)

jobPostingRoutes.get(
    "/:slug",
    ...adminWithJob,
    getJobDetailController
)

jobPostingRoutes.put(
    "/:slug",
    ...adminWithJob,
    uploadBanner,
    validate(updateJobSchema),
    updateJobController
)

jobPostingRoutes.patch(
    "/:slug/publish",
    ...adminWithJob,
    validate(publishSchema),
    togglePublishController
)

jobPostingRoutes.delete(
    "/:slug",
    ...adminWithJob,
    deleteJobController
)