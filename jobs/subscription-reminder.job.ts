import cron from "node-cron";
import { subscriptionTimeZone } from "../services/subscription-email.service.js";
import { sendSubscriptionExpiryRemindersService } from "../services/subscription-reminder.service.js";

const SUBSCRIPTION_REMINDER_SCHEDULE = "0 8 * * *";

export const startSubscriptionReminderJob = () => {
  const run = async () => {
    try {
      const result = await sendSubscriptionExpiryRemindersService();

      console.log(
        `[subscription reminder] found ${result.found}, sent ${result.sent}, failed ${result.failed}`,
      );
    } catch (error) {
      console.error("[subscription reminder] run failed", error);
    }
  };

  return cron.schedule(SUBSCRIPTION_REMINDER_SCHEDULE, run, {
    name: "subscription-reminder",
    timezone: subscriptionTimeZone(),
    noOverlap: true,
    unref: true,
  });
};
