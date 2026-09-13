import { sendEmail } from "./email.service.js";

export type SubscriptionExpiryEmailContext = {
  userName: string;
  userEmail: string;
  planName: string;
  endDate: Date;
};

export const subscriptionTimeZone = () =>
  process.env.SUBSCRIPTION_TIMEZONE ?? "Asia/Jakarta";

export const formatSubscriptionEndDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: subscriptionTimeZone(),
  }).format(date);

export const sendSubscriptionExpiryReminderEmail = (
  context: SubscriptionExpiryEmailContext,
) =>
  sendEmail({
    to: context.userEmail,
    subject: `Reminder: your ${context.planName} subscription expires tomorrow`,
    text: [
      `Hi ${context.userName},`,
      "",
      `Your ${context.planName} subscription will expire tomorrow.`,
      "",
      `Expiry date: ${formatSubscriptionEndDate(context.endDate)}`,
      "",
      "Renew your subscription to continue using your subscription benefits.",
    ].join("\n"),
  });
