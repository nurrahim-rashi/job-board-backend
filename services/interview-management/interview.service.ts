import type { JobPosting, Prisma } from "../../generated/prisma/client.js";
import type { ApplicationStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import {
  CreateInterviewInput,
  InterviewQueryInput,
  UpdateInterviewInput,
} from "../../validators/interview.validator.js";
import {
  dispatchEmails,
  InterviewEmailContext,
  sendInterviewCancelledEmail,
  sendInterviewScheduledEmail,
  sendInterviewUpdatedEmail,
} from "./interview-email.service.js";

const notSchedulable: ApplicationStatus[] = ["DRAFT", "REJECTED"];

const interviewInclude = {
  jobApplication: {
    select: {
      id: true,
      status: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  },
} satisfies Prisma.InterviewInclude;

type InterviewRecord = Prisma.InterviewGetPayload<{
  include: typeof interviewInclude;
}>;

const toResponse = (interview: InterviewRecord) => ({
  id: interview.id,
  applicationId: interview.jobApplicationId,
  interviewDate: interview.interviewDate,
  locationOrLink: interview.locationOrLink,
  notes: interview.notes,
  status: interview.status,
  reminderSentAt: interview.reminderSentAt,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
  applicant: {
    ...interview.jobApplication.user,
    applicationStatus: interview.jobApplication.status,
  },
});

const getCompany = async (job: JobPosting) => {
  const company = await prisma.company.findUnique({
    where: { id: job.companyId },
    select: { companyName: true, user: { select: { email: true } } },
  });

  if (!company) {
    throw new ApiError("Company not found", 404);
  }

  return company;
};

const buildContext = (
  job: JobPosting,
  company: { companyName: string; user: { email: string } },
  interview: InterviewRecord,
): InterviewEmailContext => ({
  applicantName: interview.jobApplication.user.name,
  applicantEmail: interview.jobApplication.user.email,
  companyName: company.companyName,
  companyEmail: company.user.email,
  jobTitle: job.title,
  interviewDate: interview.interviewDate,
  locationOrLink: interview.locationOrLink,
  notes: interview.notes,
});

const findOwnedInterview = async (job: JobPosting, interviewId: number) => {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, jobApplication: { jobId: job.id } },
    include: interviewInclude,
  });

  if (!interview) {
    throw new ApiError("Interview schedule not found", 404);
  }

  return interview;
};

const assertSlotIsFree = async (
  jobId: number,
  dates: Date[],
  excludedInterviewId?: number,
) => {
  const clash = await prisma.interview.findFirst({
    where: {
      jobApplication: { jobId },
      status: { not: "CANCELLED" },
      interviewDate: { in: dates },
      ...(excludedInterviewId && { id: { not: excludedInterviewId } }),
    },
    select: { interviewDate: true },
  });

  if (clash) {
    throw new ApiError(
      `Another applicant is already scheduled on ${clash.interviewDate.toISOString()}`,
      409,
    );
  }
};

export const createInterviewsService = async (
  job: JobPosting,
  input: CreateInterviewInput,
) => {
  const applicationIds = input.schedules.map(
    (schedule) => schedule.applicationId,
  );

  const applications = await prisma.jobApplication.findMany({
    where: { id: { in: applicationIds }, jobId: job.id },
    select: {
      id: true,
      status: true,
      user: { select: { name: true } },
      interview: { select: { id: true } },
    },
  });

  const applicationById = new Map(
    applications.map((application) => [application.id, application]),
  );

  for (const applicationId of applicationIds) {
    const application = applicationById.get(applicationId);

    if (!application) {
      throw new ApiError(
        `Applicant ${applicationId} was not found on this job posting`,
        404,
      );
    }

    if (notSchedulable.includes(application.status)) {
      throw new ApiError(
        `${application.user.name} cannot be interviewed while on ${application.status} status`,
        409,
      );
    }

    if (application.interview) {
      throw new ApiError(
        `${application.user.name} already has an interview schedule`,
        409,
      );
    }
  }

  await assertSlotIsFree(
    job.id,
    input.schedules.map((schedule) => schedule.interviewDate),
  );

  const company = await getCompany(job);

  const interviews = await prisma.$transaction(async (transaction) => {
    const created: InterviewRecord[] = [];

    for (const schedule of input.schedules) {
      created.push(
        await transaction.interview.create({
          data: {
            jobApplicationId: schedule.applicationId,
            interviewDate: schedule.interviewDate,
            locationOrLink: schedule.locationOrLink,
            notes: schedule.notes ?? null,
          },
          include: interviewInclude,
        }),
      );

      await transaction.jobApplication.update({
        where: { id: schedule.applicationId },
        data: { status: "INTERVIEW" },
      });
    }

    return created;
  });

  const notified = await dispatchEmails(
    interviews.map((interview) =>
      sendInterviewScheduledEmail(buildContext(job, company, interview)),
    ),
  );

  return { data: interviews.map(toResponse), notified };
};

export const getInterviewListService = async (
  job: JobPosting,
  query: InterviewQueryInput,
) => {
  const { page, limit, status, dateFrom, dateTo, sortOrder } = query;

  const where: Prisma.InterviewWhereInput = {
    jobApplication: { jobId: job.id },
    ...(status && { status }),
    ...((dateFrom || dateTo) && {
      interviewDate: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };

  const [interviews, total] = await prisma.$transaction([
    prisma.interview.findMany({
      where,
      orderBy: { interviewDate: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: interviewInclude,
    }),
    prisma.interview.count({ where }),
  ]);

  return {
    data: interviews.map(toResponse),
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
  };
};

export const getInterviewDetailService = async (
  job: JobPosting,
  interviewId: number,
) => toResponse(await findOwnedInterview(job, interviewId));

export const updateInterviewService = async (
  job: JobPosting,
  interviewId: number,
  input: UpdateInterviewInput,
) => {
  const interview = await findOwnedInterview(job, interviewId);

  if (interview.status === "CANCELLED" && input.status !== "SCHEDULED") {
    throw new ApiError("This interview has already been cancelled", 409);
  }

  const rescheduled =
    !!input.interviewDate &&
    input.interviewDate.getTime() !== interview.interviewDate.getTime();

  if (rescheduled) {
    await assertSlotIsFree(job.id, [input.interviewDate!], interview.id);
  }

  const updated = await prisma.interview.update({
    where: { id: interview.id },
    data: {
      ...(input.interviewDate && { interviewDate: input.interviewDate }),
      ...(input.locationOrLink && { locationOrLink: input.locationOrLink }),
      ...(input.notes !== undefined && { notes: input.notes ?? null }),
      ...(input.status && { status: input.status }),
      ...(rescheduled && { reminderSentAt: null }),
    },
    include: interviewInclude,
  });

  const company = await getCompany(job);
  const context = buildContext(job, company, updated);
  const cancelled =
    input.status === "CANCELLED" && interview.status !== "CANCELLED";

  const notified = await dispatchEmails([
    cancelled
      ? sendInterviewCancelledEmail(context)
      : sendInterviewUpdatedEmail(context),
  ]);

  return { data: toResponse(updated), notified };
};

export const deleteInterviewService = async (
  job: JobPosting,
  interviewId: number,
) => {
  const interview = await findOwnedInterview(job, interviewId);
  const company = await getCompany(job);
  const context = buildContext(job, company, interview);

  await prisma.interview.delete({ where: { id: interview.id } });

  const notified =
    interview.status === "CANCELLED"
      ? true
      : await dispatchEmails([sendInterviewCancelledEmail(context)]);

  return { notified };
};
