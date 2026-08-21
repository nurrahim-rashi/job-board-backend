import express from "express";
import "dotenv/config";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { preSelectionTestRoutes } from "./routes/pre-selection-test.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// configs
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// entry points
app.use("/auth", authRoutes);
app.use("/reviews", reviewRoutes);
app.use("/jobs", preSelectionTestRoutes);

// errors
app.use(errorHandler);

// crons

export default app;
