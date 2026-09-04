import type { JobPosting } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { calculateAge, resolveCvPath } from "../../utils/applicant.util.js";

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

  return {
    id: rest.id,
    status: rest.status,
    expectedSalary: rest.expectedSalary,
    rejectionReason: rest.rejectionReason,
    appliedAt: rest.createdAt,
    cvFile: rest.cvFile,
    cvPreviewUrl: `/job-posting/${job.slug}/applicants/${rest.id}/cv`,
    applicant: {
      ...user,
      age: calculateAge(user.birthDate),
    },
    testResult: rest.testResult,
    interview: rest.interview,
  };
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
