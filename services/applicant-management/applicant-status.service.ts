import type { JobPosting } from "../../generated/prisma/client.js";
import type { ApplicationStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { UpdateStatusInput } from "../../validators/applicant.validator.js";
import { dispatchEmails } from "../interview-management/interview-email.service.js";
import {
  sendApplicantAcceptedEmail,
  sendApplicantRejectedEmail,
} from "./applicant-email.service.js";

const nextStatuses: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  PENDING: ["PROCESS", "INTERVIEW", "REJECTED"],
  TEST_ASSIGNED: ["PROCESS", "REJECTED"],
  PROCESS: ["INTERVIEW", "ACCEPTED", "REJECTED"],
  INTERVIEW: ["ACCEPTED", "REJECTED"],
};

export const updateApplicantStatusService = async (
  job: JobPosting,
  applicationId: number,
  input: UpdateStatusInput,
) => {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, jobId: job.id },
    select: { id: true, status: true },
  });

  if (!application) {
    throw new ApiError("Applicant not found", 404);
  }

  if (application.status === "DRAFT") {
    throw new ApiError("This application has not been submitted yet", 409);
  }

  if (application.status === input.status) {
    throw new ApiError(`Applicant is already on ${input.status} status`, 409);
  }

  const allowed = nextStatuses[application.status] ?? [];

  if (!allowed.includes(input.status)) {
    throw new ApiError(
      `Status cannot be changed from ${application.status} to ${input.status}`,
      409,
    );
  }

  const updated = await prisma.jobApplication.update({
    where: { id: application.id },
    data: {
      status: input.status,
      rejectionReason:
        input.status === "REJECTED" ? input.rejectionReason : null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  await notifyDecision(job, updated);
  return updated;
};

const notifyDecision = async (
  job: JobPosting,
  application: { status: ApplicationStatus; rejectionReason: string | null; user: { name: string; email: string } },
) => {
  if (application.status !== "ACCEPTED" && application.status !== "REJECTED") return;

  const company = await prisma.company.findUnique({
    where: { id: job.companyId },
    select: { companyName: true },
  });

  const context = {
    applicantName: application.user.name,
    applicantEmail: application.user.email,
    companyName: company?.companyName ?? "The company",
    jobTitle: job.title,
    rejectionReason: application.rejectionReason,
  };

  await dispatchEmails([
    application.status === "ACCEPTED"
      ? sendApplicantAcceptedEmail(context)
      : sendApplicantRejectedEmail(context),
  ]);
};
