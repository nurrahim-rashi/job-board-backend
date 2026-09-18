export type QualityBadgeTier = "TOP" | "MIDDLE" | "LOWER" | "UNRATED";

export type QualityBadgeKey =
  | "applicantSkill"
  | "applicantFollowThrough"
  | "applicantProfile"
  | "companyProfileCompleteness"
  | "companyJobTransparency"
  | "employeeExperience"
  | "recruitmentProcess";

export type QualityBadge = {
  key: QualityBadgeKey;
  category: string;
  label: string;
  tier: QualityBadgeTier;
  value: string;
  description: string;
};

const badgeDefinitions: Record<
  QualityBadgeKey,
  {
    category: string;
    labels: Record<QualityBadgeTier, string>;
  }
> = {
  applicantSkill: {
    category: "Skills",
    labels: {
      TOP: "Expert Certified",
      MIDDLE: "Proficient",
      LOWER: "Developing Skill",
      UNRATED: "Skill Assessment Pending",
    },
  },
  applicantFollowThrough: {
    category: "Application Follow-through",
    labels: {
      TOP: "Excellent Follow-through",
      MIDDLE: "Consistent Follow-through",
      LOWER: "Needs Follow-through",
      UNRATED: "Follow-through Not Rated",
    },
  },
  applicantProfile: {
    category: "Profile",
    labels: {
      TOP: "Fully Verified Profile",
      MIDDLE: "Standard Profile",
      LOWER: "Incomplete Profile",
      UNRATED: "Pending Completion",
    },
  },
  companyProfileCompleteness: {
    category: "Profile completeness",
    labels: {
      TOP: "Complete company profile",
      MIDDLE: "Mostly complete",
      LOWER: "Needs more details",
      UNRATED: "Profile not started",
    },
  },
  companyJobTransparency: {
    category: "Job transparency",
    labels: {
      TOP: "Highly transparent roles",
      MIDDLE: "Clear role information",
      LOWER: "Needs more transparency",
      UNRATED: "No published roles yet",
    },
  },
  employeeExperience: {
    category: "Employee experience",
    labels: {
      TOP: "Top Workplace",
      MIDDLE: "Good Workplace",
      LOWER: "Developing Culture",
      UNRATED: "Limited Feedback",
    },
  },
  recruitmentProcess: {
    category: "Recruitment process",
    labels: {
      TOP: "Highly Responsive",
      MIDDLE: "Active Recruiter",
      LOWER: "Delayed Response",
      UNRATED: "Hiring Activity Pending",
    },
  },
};

export function createQualityBadge(
  key: QualityBadgeKey,
  tier: QualityBadgeTier,
  value: string,
  description: string,
): QualityBadge {
  const definition = badgeDefinitions[key];
  return {
    key,
    category: definition.category,
    label: definition.labels[tier],
    tier,
    value,
    description,
  };
}
