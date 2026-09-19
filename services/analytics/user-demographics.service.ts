import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildAgeGroups,
  mergeLabelCounts,
  percentage,
  rangeStart,
  formatLocationLabel,
} from "../../utils/analytics.util.js";
import type { AnalyticsQueryInput } from "../../validators/analytics.validator.js";

const GENDER_ORDER = ["MALE", "FEMALE", "UNDISCLOSED"] as const;

const takeTop = (
  entries: Array<{ label: string | null; count: number }>,
  total: number,
  limit: number,
) =>
  mergeLabelCounts(entries)
    .slice(0, limit)
    .map((entry) => ({ ...entry, share: percentage(entry.count, total) }));

export const getUserDemographicsService = async (query: AnalyticsQueryInput) => {
  const { months, category, limit } = query;

  const userWhere: Prisma.UserWhereInput = {
    role: "JOB_SEEKER",
    createdAt: { gte: rangeStart(months) },
    ...(category && { jobApplications: { some: { job: { category } } } }),
  };

  const [total, profiled, birthDates, genderGroups, cityGroups, provinceGroups, educationGroups] =
    await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.user.count({
        where: {
          ...userWhere,
          birthDate: { not: null },
          gender: { not: null },
          city: { not: null },
          lastEducation: { not: null },
        },
      }),
      prisma.user.findMany({ where: userWhere, select: { birthDate: true } }),
      prisma.user.groupBy({
        by: ["gender"],
        where: userWhere,
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["city", "province"],
        where: userWhere,
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["province"],
        where: userWhere,
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["lastEducation"],
        where: userWhere,
        _count: { _all: true },
      }),
    ]);

  const age = buildAgeGroups(birthDates.map((row) => row.birthDate));

  const genderCounts = new Map(
    genderGroups.map((row) => [row.gender ?? "UNDISCLOSED", row._count._all]),
  );

  return {
    total,
    averageAge: age.averageAge,
    ageGroups: age.groups,
    ageSamples: age.samples,
    genders: GENDER_ORDER.map((gender) => {
      const count = genderCounts.get(gender) ?? 0;

      return { gender, count, share: percentage(count, total) };
    }),
    cities: takeTop(
      cityGroups.map((row) => ({
        label: formatLocationLabel(row.city, row.province, "Indonesia"),
        count: row._count._all,
      })),
      total,
      limit,
    ),
    provinces: takeTop(
      provinceGroups.map((row) => ({
        label: formatLocationLabel(null, row.province, "Indonesia"),
        count: row._count._all,
      })),
      total,
      limit,
    ),
    educations: takeTop(
      educationGroups.map((row) => ({
        label: row.lastEducation,
        count: row._count._all,
      })),
      total,
      limit,
    ),
    profileCompletion: {
      completed: profiled,
      total,
      rate: percentage(profiled, total),
    },
  };
};
