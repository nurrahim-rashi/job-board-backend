import cors from "cors";
import "dotenv/config";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import type {} from "./types/express.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import { applicantTestRoutes } from "./routes/applicant-test.routes.js";
import { applicantRoutes } from "./routes/applicant.routes.js";
import { applicationRoutes } from "./routes/application.routes.js";
import { assessmentRoutes } from "./routes/assessment.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { companyRoutes } from "./routes/company.routes.js";
import { cronRoutes } from "./routes/cron.routes.js";
import { interviewRoutes } from "./routes/interview.routes.js";
import { jobPostingRoutes } from "./routes/job-posting.routes.js";
import { jobRoutes } from "./routes/job.routes.js";
import { preSelectionTestRoutes } from "./routes/pre-selection-test.routes.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { cvRoutes } from "./routes/cv.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { subscriptionRoutes } from "./routes/subscription.routes.js";
import { regionRoutes } from "./routes/region.routes.js";
import { exchangeRateRoutes } from "./routes/exchange-rate.routes.js";
import { savedJobRoutes } from "./routes/saved-job.routes.js";
import { isImageStorageConfigured } from "./lib/cloudinary.js";

const app = express();

app.set("trust proxy", 1);
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

const logger = pino(
  isTest
    ? { level: "silent" }
    : {
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
      },
);

app.use((pinoHttp as any)({ logger }));

// configs
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads/cvs", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});
app.use("/uploads", express.static("uploads"));

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Polaris API",
    health: "/health",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    message: "Polaris API is healthy",
    services: {
      imageStorage: isImageStorageConfigured() ? "configured" : "missing",
    },
  });
});

// entry points
app.use("/auth", authRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/reviews", reviewRoutes);
app.use("/assessment", assessmentRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/cv", cvRoutes);
app.use("/jobs", jobRoutes);
app.use("/jobs", applicantTestRoutes);
app.use("/job-posting", preSelectionTestRoutes);
app.use("/job-posting", applicantRoutes);
app.use("/job-posting", interviewRoutes);
app.use("/job-posting", jobPostingRoutes);
app.use("/companies", companyRoutes);
app.use("/profiles", profileRoutes);
app.use("/regions", regionRoutes);
app.use("/exchange-rates", exchangeRateRoutes);
app.use("/cron", cronRoutes);
app.use("/", applicationRoutes);
app.use("/", savedJobRoutes);

// errors
app.use(errorHandler);

export default app;
