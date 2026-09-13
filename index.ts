import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

import app from "./app.js";
import { startInterviewReminderJob } from "./jobs/interview-reminder.job.js";
import { startSubscriptionExpiryJob } from "./jobs/subscription-expiry.job.js";
import { startSubscriptionReminderJob } from "./jobs/subscription-reminder.job.js";

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
  startInterviewReminderJob();
  startSubscriptionExpiryJob();
  startSubscriptionReminderJob();
});