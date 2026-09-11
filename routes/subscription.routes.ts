import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  getSubscriptionPlansController,
  getDeveloperSubscriptionPlansController,
  updateSubscriptionPlanController,
} from "../controllers/subscription.controller.js";
import { updateSubscriptionSchema } from "../validators/subscription.validator.js";

export const subscriptionRoutes = express.Router();

subscriptionRoutes.get("/", getSubscriptionPlansController);

subscriptionRoutes.get(
  "/manage",
  verifyToken(process.env.JWT_SECRET!),
  getDeveloperSubscriptionPlansController,
);

subscriptionRoutes.patch(
  "/:name",
  verifyToken(process.env.JWT_SECRET!),
  validate(updateSubscriptionSchema),
  updateSubscriptionPlanController,
);
