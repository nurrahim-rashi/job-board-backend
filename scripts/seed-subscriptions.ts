import { prisma } from "../lib/prisma.js";

const seedSubscriptions = async () => {
  await prisma.subscription.upsert({
    where: {
      name: "STANDARD",
    },
    update: {},
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

  await prisma.subscription.upsert({
    where: {
      name: "PROFESSIONAL",
    },
    update: {},
    create: {
      name: "PROFESSIONAL",
      price: 100000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: null,
        priorityReview: true,
      },
    },
  });

  console.log("Subscription plans seeded successfully");
};

seedSubscriptions()
  .catch((error) => {
    console.error("Failed to seed subscription plans", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
