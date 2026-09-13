import cron from "node-cron";
import { expireSubscriptionsService } from "../services/subscription.service.js";

const SUBSCRIPTION_EXPIRY_SCHEDULE = "0 * * * *";

export const startSubscriptionExpiryJob = () => {
  const run = async () => {
    try {
      const result = await expireSubscriptionsService();

      console.log(
        `[subscription expiry] expired ${result.expired} subscription(s)`,
      );
    } catch (error) {
      console.error("[subscription expiry] run failed", error);
    }
  };

  return cron.schedule(SUBSCRIPTION_EXPIRY_SCHEDULE, run, {
    name: "subscription-expiry",
    noOverlap: true,
    unref: true,
  });
};
