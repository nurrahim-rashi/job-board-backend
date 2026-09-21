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

const INTERVIEW_SLOT_MINUTES = 60;
const SLOT_MS = INTERVIEW_SLOT_MINUTES * 60_000;

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

// An interview occupies a slot rather than an instant, so two schedules clash whenever they start
// less than one slot apart. Matching on equal timestamps let an admin book 09:00 and 09:01.
const assertSlotIsFree = async (
  jobId: number,
  dates: Date[],
  excludedInterviewId?: number,
) => {
  const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = ordered[index]!.getTime() - ordered[index - 1]!.getTime();
    if (gap < SLOT_MS) {
      throw new ApiError(
        `Two of the selected schedules are less than ${INTERVIEW_SLOT_MINUTES} minutes apart`,
        409,
      );
    }
  }

  const clash = await prisma.interview.findFirst({
    where: {
      jobApplication: { jobId },
      status: { not: "CANCELLED" },
      OR: dates.map((date) => ({
        interviewDate: {
          gt: new Date(date.getTime() - SLOT_MS),
          lt: new Date(date.getTime() + SLOT_MS),
        },
      })),
      ...(excludedInterviewId && { id: { not: excludedInterviewId } }),
    },
    select: { interviewDate: true },
  });

  if (clash) {
    throw new ApiError(
      `Another applicant is already scheduled within ${INTERVIEW_SLOT_MINUTES} minutes of ${clash.interviewDate.toISOString()}`,
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

  let interviews: InterviewRecord[];
  try {
    const updatedApplications = await prisma.$transaction(
      input.schedules.map((schedule) =>
        prisma.jobApplication.update({
          where: { id: schedule.applicationId },
          data: {
            status: "INTERVIEW",
            interview: {
              create: {
                interviewDate: schedule.interviewDate,
                locationOrLink: schedule.locationOrLink,
                notes: schedule.notes ?? null,
              },
            },
          },
          select: { interview: { include: interviewInclude } },
        }),
      ),
    );
    interviews = updatedApplications.flatMap((application) =>
      application.interview ? [application.interview] : [],
    );
    if (interviews.length !== input.schedules.length) {
      throw new Error("Interview transaction returned incomplete data");
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "P2002") {
      throw new ApiError(
        "One of the selected applicants already has an interview schedule",
        409,
      );
    }
    if (code === "P2025") {
      throw new ApiError(
        "One of the selected applications no longer exists",
        404,
      );
    }
    console.error("Unable to create interview schedules", error);
    throw new ApiError(
      "Interview scheduling is temporarily unavailable. Please try again.",
      503,
    );
  }

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

  const nextDate = input.interviewDate ?? interview.interviewDate;
  if (input.status === "COMPLETED" && nextDate.getTime() > Date.now()) {
    throw new ApiError(
      "This interview cannot be marked completed before it takes place",
      409,
    );
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
