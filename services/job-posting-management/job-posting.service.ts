import { JobPosting } from "../../generated/prisma/client.js";
import { uploadImage } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { geocodeLocation } from "../geocoding.service.js";
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
  banner?: Express.Multer.File,
) => {
  const company = await prisma.company.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!company) {
    throw new ApiError("Company isn't found", 403);
  }

  const slug = slugify(input.title) + "-" + randomSuffix();

  const bannerUrl = banner ? (await uploadImage(banner)).secure_url : undefined;
  const coordinates = await geocodeLocation(
    input.cityLocation,
    input.countryLocation,
    input.provinceLocation,
  );

  return prisma.jobPosting.create({
    data: {
      ...input,
      banner: bannerUrl,
      ...coordinates,
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
  banner?: Express.Multer.File,
) => {
  if (!banner && Object.keys(input).length === 0) {
    throw new ApiError("No data was modified", 400);
  }

  const { removeBanner, ...jobInput } = input;
  const salaryMin = jobInput.salaryMin ?? job.salaryMin;
  const salaryMax = jobInput.salaryMax ?? job.salaryMax;

  if (salaryMin && salaryMax && salaryMax < salaryMin) {
    throw new ApiError(
      "Maximum salary should be greater than minimum salary",
      400,
    );
  }

  const bannerUrl = banner ? (await uploadImage(banner)).secure_url : undefined;
  const locationChanged =
    (jobInput.cityLocation !== undefined && jobInput.cityLocation !== job.cityLocation) ||
    (jobInput.provinceLocation !== undefined &&
      jobInput.provinceLocation !== job.provinceLocation) ||
    (jobInput.countryLocation !== undefined &&
      jobInput.countryLocation !== job.countryLocation);
  const coordinates = locationChanged
    ? await geocodeLocation(
        jobInput.cityLocation ?? job.cityLocation,
        jobInput.countryLocation ?? job.countryLocation,
        jobInput.provinceLocation ?? job.provinceLocation,
      )
    : undefined;

  return prisma.jobPosting.update({
    where: { id: job.id },
    data: {
      ...jobInput,
      ...(locationChanged
        ? {
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
          }
        : {}),
      ...(removeBanner ? { banner: null } : bannerUrl ? { banner: bannerUrl } : {}),
    },
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
