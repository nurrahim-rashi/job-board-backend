import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import pino from "pino";
import app from "./app.js";
import { startInterviewReminderJob } from "./jobs/interview-reminder.job.js";
import { startSubscriptionExpiryJob } from "./jobs/subscription-expiry.job.js";
import { startSubscriptionReminderJob } from "./jobs/subscription-reminder.job.js";

// Buat logger khusus untuk startup message (atau bisa diimpor dari file terpisah jika ingin shared)
const logger = pino({
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
});

const PORT = process.env.PORT || 8000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`Server running on PORT ${PORT}`);

    startInterviewReminderJob();
    startSubscriptionExpiryJob();
    startSubscriptionReminderJob();
  });
}

export default app;
