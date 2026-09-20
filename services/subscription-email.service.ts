import { sendEmail } from "./email.service.js";
import { buildPolarisEmail } from "./email-template.service.js";

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
) => {
  const pricingUrl = `${(process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "")}/pricing`;
  return sendEmail({
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
    html: buildPolarisEmail({
      preheader: `Your ${context.planName} subscription expires tomorrow.`,
      eyebrow: "Subscription reminder",
      title: "Keep your Polaris benefits",
      greeting: `Hi ${context.userName},`,
      message: `Your ${context.planName} subscription will expire tomorrow. Renew it to keep using your subscription benefits without interruption.`,
      details: [
        { label: "Plan", value: context.planName },
        { label: "Expiry date", value: formatSubscriptionEndDate(context.endDate) },
      ],
      action: { label: "View subscription plans", url: pricingUrl },
    }),
  });
};
