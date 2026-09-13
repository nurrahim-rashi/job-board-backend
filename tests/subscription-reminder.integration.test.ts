import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../services/subscription-email.service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../services/subscription-email.service.js")
  >("../services/subscription-email.service.js");

  return {
    ...actual,
    sendSubscriptionExpiryReminderEmail: vi.fn(),
  };
});

import { prisma } from "../lib/prisma.js";
import { sendSubscriptionExpiryReminderEmail } from "../services/subscription-email.service.js";
import { sendSubscriptionExpiryRemindersService } from "../services/subscription-reminder.service.js";

let testUserIds: number[] = [];
let testSubscriptionIds: number[] = [];

const mockedSendReminderEmail = vi.mocked(sendSubscriptionExpiryReminderEmail);

const getStandardPlan = async () =>
  prisma.subscription.upsert({
    where: {
      name: "STANDARD",
    },
    update: {
      price: 25000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: 2,
      },
    },
    create: {
      name: "STANDARD",
      price: 25000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: 2,
      },
    },
  });

const createJobSeeker = async () => {
  const user = await prisma.user.create({
    data: {
      name: "Subscription Reminder User",
      email: `subscription-reminder-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
    },
  });

  testUserIds.push(user.id);

  return user;
};

const createUserSubscription = async ({
  status = "ACTIVE",
  endDate,
  expiryReminderSentAt = null,
}: {
  status?: "PENDING_APPROVAL" | "ACTIVE" | "EXPIRED";
  endDate: Date;
  expiryReminderSentAt?: Date | null;
}) => {
  const user = await createJobSeeker();
  const plan = await getStandardPlan();

  const userSubscription = await prisma.userSubscription.create({
    data: {
      userId: user.id,
      subscriptionId: plan.id,
      status,
      startDate: new Date("2026-08-15T08:00:00+07:00"),
      endDate,
      expiryReminderSentAt,
    },
  });

  testSubscriptionIds.push(userSubscription.id);

  return {
    user,
    plan,
    userSubscription,
  };
};

describe("Subscription expiry reminder", () => {
  beforeEach(async () => {
    await getStandardPlan();

    mockedSendReminderEmail.mockReset();
    mockedSendReminderEmail.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (testSubscriptionIds.length > 0) {
      await prisma.userSubscription.deleteMany({
        where: {
          id: {
            in: testSubscriptionIds,
          },
        },
      });

      testSubscriptionIds = [];
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });

      testUserIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sends a reminder for an active subscription expiring tomorrow", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    const { user, plan, userSubscription } = await createUserSubscription({
      endDate: new Date("2026-09-14T18:00:00+07:00"),
    });

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 1,
      sent: 1,
      failed: 0,
    });

    expect(mockedSendReminderEmail).toHaveBeenCalledOnce();

    expect(mockedSendReminderEmail).toHaveBeenCalledWith({
      userName: user.name,
      userEmail: user.email,
      planName: plan.name,
      endDate: userSubscription.endDate,
    });

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.expiryReminderSentAt).not.toBeNull();
  });

  it("does not send a reminder for a subscription expiring today", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    await createUserSubscription({
      endDate: new Date("2026-09-13T20:00:00+07:00"),
    });

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 0,
      sent: 0,
      failed: 0,
    });

    expect(mockedSendReminderEmail).not.toHaveBeenCalled();
  });

  it("does not send a reminder for a subscription expiring in two days", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    await createUserSubscription({
      endDate: new Date("2026-09-15T08:00:00+07:00"),
    });

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 0,
      sent: 0,
      failed: 0,
    });

    expect(mockedSendReminderEmail).not.toHaveBeenCalled();
  });

  it("does not send the reminder again when it was already sent", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    await createUserSubscription({
      endDate: new Date("2026-09-14T12:00:00+07:00"),
      expiryReminderSentAt: new Date("2026-09-13T08:00:00+07:00"),
    });

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 0,
      sent: 0,
      failed: 0,
    });

    expect(mockedSendReminderEmail).not.toHaveBeenCalled();
  });

  it("does not send reminders for subscriptions that are not active", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    await createUserSubscription({
      status: "PENDING_APPROVAL",
      endDate: new Date("2026-09-14T10:00:00+07:00"),
    });

    await createUserSubscription({
      status: "EXPIRED",
      endDate: new Date("2026-09-14T11:00:00+07:00"),
    });

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 0,
      sent: 0,
      failed: 0,
    });

    expect(mockedSendReminderEmail).not.toHaveBeenCalled();
  });

  it("does not mark the reminder as sent when email delivery fails", async () => {
    const now = new Date("2026-09-13T10:00:00+07:00");

    const { userSubscription } = await createUserSubscription({
      endDate: new Date("2026-09-14T17:00:00+07:00"),
    });

    mockedSendReminderEmail.mockRejectedValueOnce(
      new Error("Email delivery failed"),
    );

    const result = await sendSubscriptionExpiryRemindersService(now);

    expect(result).toEqual({
      found: 1,
      sent: 0,
      failed: 1,
    });

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.expiryReminderSentAt).toBeNull();
  });
});
