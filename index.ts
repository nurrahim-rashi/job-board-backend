import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import pino from "pino";
import * as pinoHttp from "pino-http";
import app from "./app.js";
import { startInterviewReminderJob } from "./jobs/interview-reminder.job.js";
import { startSubscriptionExpiryJob } from "./jobs/subscription-expiry.job.js";
import { startSubscriptionReminderJob } from "./jobs/subscription-reminder.job.js";

// 1. Inisialisasi Logger Pino
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
      : undefined, // Di production langsung cetak JSON murni agar performa maksimal
});

// 2. Pasang pino-http middleware ke Express app (jika app.js mengekspor instance express)
// Catatan: Pastikan ini dipasang sebelum routes didefinisikan di app.js,
// atau Anda bisa memasangnya langsung di dalam file app.js Anda.
app.use((pinoHttp as any)({ logger }));

const PORT = process.env.PORT || 8000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    // 3. Gunakan logger.info alih-alih console.log
    logger.info(`Server running on PORT ${PORT}`);

    startInterviewReminderJob();
    startSubscriptionExpiryJob();
    startSubscriptionReminderJob();
  });
}

export default app;
