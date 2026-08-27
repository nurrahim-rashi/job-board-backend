import { JobPosting } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { slugify } from "../../utils/slug.js";
import {
  CreateJobInput,
  UpdateJobInput,
} from "../../validators/job-posting.validator.js";

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

export const createJobService = async (
  userId: number,
  input: CreateJobInput,
) => {
  const company = await prisma.company.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!company) {
    throw new ApiError("Company isn't found", 403);
  }

  const slug = slugify(input.title) + "-" + randomSuffix();

  return prisma.jobPosting.create({
    data: {
      ...input,
      companyId: company.id,
      slug,
    },
  });
};

export const getJobDetailsService = async (job: JobPosting) => {
  const [totalApplicant, totalQuestionPreSelectionTest] = await Promise.all([
    await prisma.jobApplication.count({
      where: { jobId: job.id, status: { not: "DRAFT" } },
    }),
    await prisma.preSelectionTest.count({
      where: { jobId: job.id },
    }),
  ]);

  return {
    ...job,
    totalApplicant,
    totalQuestionPreSelectionTest,
  };
};

export const updateJobService = async (
  job: JobPosting,
  input: UpdateJobInput,
) => {
  const salaryMin = input.salaryMin ?? job.salaryMin;
  const salaryMax = input.salaryMax ?? job.salaryMax;

  if (salaryMin && salaryMax && salaryMax < salaryMin) {
    throw new ApiError(
      "Maximum salary should be greater than minimum salary",
      400,
    );
  }

  return prisma.jobPosting.update({
    where: { id: job.id },
    data: input ,
  });
};

export const togglePublishService = async (
  job: JobPosting,
  isPublished: boolean,
) => {
  if (isPublished && job.deadline < new Date()) {
    throw new ApiError("Job Posting has passed the deadline", 400);
  }

  return await prisma.jobPosting.update({
    where: { id: job.id },
    data: { isPublished },
  });
};

export const deleteJobService = async (job: JobPosting) => {
    await prisma.jobPosting.update({
        where: {id: job.id},
        data: {deletedAt: new Date(), isPublished: false}
    })

    return {
        message: "Job posting deleted successfully"
    }
}

export const getCompanyId = async (userId: number) => {
    const company= await prisma.company.findUnique({
        where: {userId},
        select: {id: true}
    })

    if (!company) {
        throw new ApiError("Company profile has not been created", 403)
    }

    return company.id;
}

