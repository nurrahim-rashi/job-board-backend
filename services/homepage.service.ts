import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

function startOfTuesday() {
  const now = new Date();
  const daysSinceTuesday = (now.getDay() - 2 + 7) % 7;
  const result = new Date(now);
  result.setDate(now.getDate() - daysSinceTuesday);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function getHomepageData(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailVerifiedAt: true,
      birthDate: true,
      gender: true,
      lastEducation: true,
      address: true,
      city: true,
      province: true,
      avatar: true,
      role: true,
    },
  });
  if (!user) throw new ApiError("User not found", 404);
  if (user.role !== "JOB_SEEKER") {
    throw new ApiError("Homepage data is only available to job seekers", 403);
  }

  const profileFields = [
    user.name,
    user.email,
    user.emailVerifiedAt,
    user.birthDate,
    user.gender,
    user.lastEducation,
    user.address,
    user.city,
    user.province,
    user.avatar,
  ];
  const profileCompletion = Math.round(
    (profileFields.filter(Boolean).length / profileFields.length) * 100,
  );

  const activeJobWhere = {
    isPublished: true,
    deletedAt: null,
    deadline: { gte: new Date() },
  } as const;

  const [applications, candidateJobs, newJobs, applicationCount, interviewCount] =
    await Promise.all([
      prisma.jobApplication.findMany({
        where: { userId },
        take: 4,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          job: {
            select: {
              slug: true,
              title: true,
              company: { select: { companyName: true } },
            },
          },
        },
      }),
      prisma.jobPosting.findMany({
        where: {
          ...activeJobWhere,
          applications: { none: { userId } },
        },
        take: 12,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          cityLocation: true,
          provinceLocation: true,
          countryLocation: true,
          category: true,
          createdAt: true,
          company: { select: { companyName: true } },
        },
      }),
      prisma.jobPosting.count({
        where: { ...activeJobWhere, createdAt: { gte: startOfTuesday() } },
      }),
      prisma.jobApplication.count({ where: { userId } }),
      prisma.interview.count({
        where: { jobApplication: { userId }, status: "SCHEDULED" },
      }),
    ]);

  const recommendations = candidateJobs
    .map((job) => {
      const sameCity = Boolean(
        user.city &&
          job.cityLocation.toLowerCase().includes(user.city.toLowerCase()),
      );
      return {
        ...job,
        score: sameCity ? 92 : 78,
        reason: sameCity
          ? `Matches your location in ${user.city}`
          : `A recently published ${job.category.toLowerCase().replaceAll("_", " ")} role`,
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);

  return {
    overview: {
      name: user.name,
      city: user.city,
      newJobs,
      stats: [
        { label: "Applications", value: String(applicationCount), note: "Total submitted" },
        { label: "Interviews", value: String(interviewCount), note: "Currently scheduled" },
        { label: "Profile", value: `${profileCompletion}%`, note: "Complete" },
      ],
    },
    profileCompletion,
    applications,
    recommendations,
  };
}
