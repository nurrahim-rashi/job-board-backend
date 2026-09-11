import { Response, Request } from "express";
import {
  getSubscriptionPlansService,
  getDeveloperSubscriptionPlansService,
  updateSubscriptionPlanService,
} from "../services/subscription.service.js";

export const getSubscriptionPlansController = async (
  _req: Request,
  res: Response,
) => {
  const subscriptions = await getSubscriptionPlansService();

  return res.status(200).json({
    message: "Subscription plans retrieved successfully",
    data: subscriptions,
  });
};

export const getDeveloperSubscriptionPlansController = async (
  _req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;

  const subscriptions = await getDeveloperSubscriptionPlansService(userRole);

  return res.status(200).json({
    message: "Subscription plans retrieved successfully",
    data: subscriptions,
  });
};

export const updateSubscriptionPlanController = async (
  req: Request,
  res: Response,
) => {
  const userRole = res.locals.user.role;
  const name = String(req.params.name);

  const subscription = await updateSubscriptionPlanService(
    userRole,
    name,
    req.body,
  );

  return res.status(200).json({
    message: "Subscription plan updated successfully",
    data: subscription,
  });
};
