import express from "express";
import "dotenv/config";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { preSelectionTestRoutes } from "./routes/pre-selection-test.routes.js";
import { applicantTestRoutes } from "./routes/applicant-test.routes.js";
import { assessmentRoutes } from "./routes/assessment.routes.js";
import { jobRoutes } from "./routes/job.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { jobPostingRoutes } from "./routes/job-posting.routes.js";
import { applicationRoutes } from "./routes/application.routes.js";
import { applicantRoutes } from "./routes/applicant.routes.js";
import { companyRoutes } from "./routes/company.routes.js";
import { cvRoutes } from "./routes/cv.routes.js";

const app = express();

// configs
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// entry points
app.use("/auth", authRoutes);
app.use("/reviews", reviewRoutes);
app.use("/assessment", assessmentRoutes);
app.use("/cv", cvRoutes);
app.use("/jobs", jobRoutes); 
app.use("/jobs", applicantTestRoutes);
app.use("/job-posting", preSelectionTestRoutes); 
app.use("/job-posting", applicantRoutes);
app.use("/job-posting", jobPostingRoutes);
app.use("/companies", companyRoutes);
app.use("/", applicationRoutes);

// errors
app.use(errorHandler);

// crons

export default app;
