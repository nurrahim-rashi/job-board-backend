import { Response, Request } from "express";
import {
  getSubscriptionPlansService,
  getDeveloperSubscriptionPlansService,
  updateSubscriptionPlanService,
  purchaseSubscriptionService,
  handleMidtransNotificationService,
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

export const purchaseSubscriptionController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const userRole = res.locals.user.role;

  const result = await purchaseSubscriptionService(userId, userRole, req.body);

  return res.status(201).json({
    message: "Subscription payment created successfully",
    data: result,
  });
};

export const midtransNotificationController = async (
  req: Request,
  res: Response,
) => {
  const result = await handleMidtransNotificationService(req.body);

  return res.status(200).json({
    message: "Payment notification processed successfully",
    data: result,
  });
};
