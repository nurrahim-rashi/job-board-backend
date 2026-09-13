import { prisma } from "../lib/prisma.js";
import {
  sendSubscriptionExpiryReminderEmail,
  subscriptionTimeZone,
} from "./subscription-email.service.js";

const zonedDayStart = (date: Date, timeZone: string, daysAhead: number) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const target = new Date(Date.UTC(year, month - 1, day + daysAhead));

  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });

  const offsetPart = offsetFormatter
    .formatToParts(target)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = offsetPart?.match(/GMT([+-])(\d{2}):(\d{2})/);

  const offsetMinutes = match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;

  return new Date(target.getTime() - offsetMinutes * 60 * 1000);
};

export const sendSubscriptionExpiryRemindersService = async (
  now = new Date(),
) => {
  const timeZone = subscriptionTimeZone();

  const tomorrow = zonedDayStart(now, timeZone, 1);
  const dayAfterTomorrow = zonedDayStart(now, timeZone, 2);

  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      status: "ACTIVE",
      expiryReminderSentAt: null,
      endDate: {
        gte: tomorrow,
        lt: dayAfterTomorrow,
      },
    },
    orderBy: {
      endDate: "asc",
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      subscription: {
        select: {
          name: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const userSubscription of subscriptions) {
    if (!userSubscription.endDate) {
      continue;
    }

    try {
      await sendSubscriptionExpiryReminderEmail({
        userName: userSubscription.user.name,
        userEmail: userSubscription.user.email,
        planName: userSubscription.subscription.name,
        endDate: userSubscription.endDate,
      });

      await prisma.userSubscription.update({
        where: {
          id: userSubscription.id,
        },
        data: {
          expiryReminderSentAt: new Date(),
        },
      });

      sent += 1;
    } catch (error) {
      failed += 1;

      console.error(
        `Unable to deliver subscription expiry reminder ${userSubscription.id}`,
        error,
      );
    }
  }

  return {
    found: subscriptions.length,
    sent,
    failed,
  };
};
