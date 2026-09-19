import { randomUUID } from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeEach } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../utils/password.js";

export const testMarker = `api-integration-${randomUUID()}`;
export const validPassword = "StrongPass1!";

const cvDirectory = join(process.cwd(), "uploads", "cvs");
let cvFilesBeforeTest = new Set<string>();

export function createTestEmail(label: string) {
  return `${testMarker}-${label}-${randomUUID()}@example.test`;
}

export function createAuthToken(user: { id: number; role: string }) {
  return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

export async function createTestSeeker(
  label: string,
  overrides: Partial<
    Omit<Prisma.UserUncheckedCreateInput, "id" | "name" | "email" | "role">
  > = {},
) {
  return prisma.user.create({
    data: {
      name: `Integration ${label}`,
      email: createTestEmail(label),
      password: await hashPassword(validPassword),
      role: "JOB_SEEKER",
      authProvider: "EMAIL",
      ...overrides,
    },
  });
}

export async function createTestCompany(label: string) {
  const admin = await prisma.user.create({
    data: {
      name: `Integration ${label} Admin`,
      email: createTestEmail(`${label}-admin`),
      password: await hashPassword(validPassword),
      role: "COMPANY_ADMIN",
      authProvider: "EMAIL",
      emailVerifiedAt: new Date(),
    },
  });
  const company = await prisma.company.create({
    data: {
      userId: admin.id,
      companyName: `${testMarker} ${label}`,
      phone: "081234567890",
      profileContent: `${label} builds reliable products.`,
      tagline: "Work worth doing",
      city: label.includes("Bandung") ? "Bandung" : "Jakarta",
      province: label.includes("Bandung") ? "West Java" : "Jakarta",
      country: "Indonesia",
    },
  });
  return { admin, company };
}

export async function createTestJob(
  companyId: number,
  label: string,
  overrides: Partial<
    Omit<
      Prisma.JobPostingUncheckedCreateInput,
      | "id"
      | "companyId"
      | "title"
      | "slug"
      | "description"
      | "category"
      | "cityLocation"
      | "deadline"
    >
  > & {
    category?: Prisma.JobPostingUncheckedCreateInput["category"];
    cityLocation?: string;
    deadline?: Date | string;
  } = {},
) {
  return prisma.jobPosting.create({
    data: {
      companyId,
      title: `${label} Engineer`,
      slug: `${testMarker}-${label.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}`,
      description: `${label} role created by the integration test.`,
      category: "TECHNOLOGY",
      cityLocation: "Jakarta",
      provinceLocation: "Jakarta",
      countryLocation: "Indonesia",
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      isPublished: true,
      ...overrides,
    },
  });
}

async function removeNewCvFiles() {
  let files: string[];
  try {
    files = await readdir(cvDirectory);
  } catch {
    return;
  }
  await Promise.all(
    files
      .filter((file) => !cvFilesBeforeTest.has(file))
      .map((file) => unlink(join(cvDirectory, file)).catch(() => undefined)),
  );
}

export function setupApiIntegrationLifecycle() {
  beforeEach(async () => {
    try {
      cvFilesBeforeTest = new Set(await readdir(cvDirectory));
    } catch {
      cvFilesBeforeTest = new Set();
    }
  });

  afterEach(async () => {
    await removeNewCvFiles();
    await prisma.interview.deleteMany({
      where: { jobApplication: { user: { email: { contains: testMarker } } } },
    });
    await prisma.applicantTestResult.deleteMany({
      where: { user: { email: { contains: testMarker } } },
    });
    await prisma.jobApplication.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: testMarker } } },
          { job: { slug: { contains: testMarker } } },
        ],
      },
    });
    await prisma.jobPosting.deleteMany({
      where: { slug: { contains: testMarker } },
    });
    await prisma.companyReview.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: testMarker } } },
          { company: { companyName: { contains: testMarker } } },
        ],
      },
    });
    await prisma.company.deleteMany({
      where: { companyName: { contains: testMarker } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: testMarker } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}
