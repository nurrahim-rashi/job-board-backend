import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export async function getPublicSeekerProfile(userId: number, requesterId?: number) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      lastEducation: true,
      city: true,
      province: true,
      professionalRole: true,
      availability: true,
      salaryExpectation: true,
      profileStory: true,
      skills: true,
      profileLinks: true,
      experiences: true,
      selectedWork: true,
      isPublicProfile: true,
      company: { select: { id: true, companyName: true } },
    },
  });
  if (!profile || (!profile.isPublicProfile && requesterId !== profile.id)) {
    throw new ApiError("Profile not found", 404);
  }
  const { isPublicProfile: _visibility, ...publicProfile } = profile;
  return publicProfile;
}
