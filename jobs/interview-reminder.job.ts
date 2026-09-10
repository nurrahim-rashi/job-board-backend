import cron from "node-cron";
import { interviewTimeZone } from "../services/interview-management/interview-email.service.js";
import { sendInterviewRemindersService } from "../services/interview-management/interview-reminder.service.js";

const REMINDER_SCHEDULE = "0 8 * * *";

export const startInterviewReminderJob = () => {
  const run = async () => {
    try {
      const result = await sendInterviewRemindersService();

      console.log(
        `[interview reminder] found ${result.found}, sent ${result.sent}, failed ${result.failed}`,
      );
    } catch (error) {
      console.error("[interview reminder] run failed", error);
    }
  };

  return cron.schedule(REMINDER_SCHEDULE, run, {
    name: "interview-reminder",
    timezone: interviewTimeZone(),
    noOverlap: true,
    unref: true,
  });
};
