import express from "express";
import "dotenv/config";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { reviewRoutes } from "./routes/review.routes.js";

const app = express();

// configs
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// entry points
app.use("/reviews", reviewRoutes);

// errors

// crons

export default app;