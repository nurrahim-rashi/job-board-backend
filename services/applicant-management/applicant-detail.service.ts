import { Prisma, type JobPosting } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { calculateAge, resolveCvPath } from "../../utils/applicant.util.js";
import { readInterviewProposal } from "../../utils/interview-proposal.util.js";

export const getApplicantDetailService = async (
  job: JobPosting,
  applicationId: number,
) => {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, jobId: job.id, status: { not: "DRAFT" } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          birthDate: true,
          gender: true,
          lastEducation: true,
          address: true,
          city: true,
          province: true,
        },
      },
      testResult: {
        select: { score: true, startedAt: true, submittedAt: true },
      },
      interview: true,
    },
  });

  if (!application) {
    throw new ApiError("Applicant not found", 404);
  }

  const { user, ...rest } = application;
  let expectedSalaryRequestedAt: Date | null = null;
  try {
    const [salaryRequest] = await prisma.$queryRaw<Array<{ expectedSalaryRequestedAt: Date | null }>>(Prisma.sql`
      SELECT "expectedSalaryRequestedAt" FROM "job_applications" WHERE "id" = ${applicationId}
    `);
    expectedSalaryRequestedAt = salaryRequest?.expectedSalaryRequestedAt ?? null;
  } catch {
    // Keep applicant details usable while the additive nudge migration is pending.
  }
  const parsedInterview = rest.interview ? readInterviewProposal(rest.interview.notes) : null;

  return {
    id: rest.id,
    status: rest.status,
    expectedSalary: rest.expectedSalary,
    expectedSalaryRequestedAt,
    rejectionReason: rest.rejectionReason,
    appliedAt: rest.createdAt,
    cvFile: rest.cvFile,
    cvPreviewUrl: `/job-posting/${job.slug}/applicants/${rest.id}/cv`,
    applicant: {
      ...user,
      lastEducation: rest.lastEducationSnapshot ?? user.lastEducation,
      age: calculateAge(user.birthDate),
    },
    testResult: rest.testResult,
    interview: rest.interview ? { ...rest.interview, notes: parsedInterview?.notes, ...parsedInterview?.proposal } : null,
  };
};

export const requestExpectedSalaryService = async (job: JobPosting, applicationId: number) => {
  const updated = await prisma.$queryRaw<Array<{ id: number; expectedSalaryRequestedAt: Date }>>(Prisma.sql`
    UPDATE "job_applications"
    SET "expectedSalaryRequestedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${applicationId}
      AND "jobId" = ${job.id}
      AND "status" <> 'DRAFT'::"ApplicationStatus"
      AND "expectedSalary" IS NULL
    RETURNING "id", "expectedSalaryRequestedAt"
  `);
  if (!updated.length) throw new ApiError("Expected salary is already provided or applicant was not found", 400);
  return updated[0];
};

export const getApplicantCvService = async (
  jobId: number,
  applicationId: number,
) => {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, jobId, status: { not: "DRAFT" } },
    select: { cvFile: true, user: { select: { name: true } } },
  });

  if (!application) {
    throw new ApiError("Applicant not found", 404);
  }

  return {
    path: resolveCvPath(application.cvFile),
    fileName: `CV-${application.user.name}.pdf`,
  };
};
