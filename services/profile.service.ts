import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export async function getPublicSeekerProfile(userId: number, requesterId?: number) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      emailVerifiedAt: true,
      role: true,
      avatar: true,
      birthDate: true,
      gender: true,
      address: true,
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
      jobApplications: {
        where: { status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        select: { status: true, cvFile: true, testResult: { select: { submittedAt: true } }, interview: { select: { id: true, status: true, notes: true } }, job: { select: { slug: true, title: true, hasPreSelectionTest: true, company: { select: { companyName: true } } } } },
      },
      assessmentResults: { where: { completedAt: { not: null } }, select: { score: true, isPassed: true, assessment: { select: { skillName: true } } } },
    },
  });
  if (!profile || (!profile.isPublicProfile && requesterId !== profile.id)) {
    throw new ApiError("Profile not found", 404);
  }
  const { isPublicProfile: _visibility, jobApplications, assessmentResults, birthDate, gender, address, ...publicProfile } = profile;
  const totalApplications = jobApplications.length;
  const interviews = jobApplications.filter((application) => application.interview).length;
  const responses = jobApplications.filter((application) => !["PENDING", "DRAFT"].includes(application.status)).length;
  const reliabilityPenalty = 0;
  const completedAssessments = assessmentResults.length;
  const averageAssessment = completedAssessments ? Math.round(assessmentResults.reduce((sum, result) => sum + result.score, 0) / completedAssessments) : null;
  const profileFields = [profile.name, profile.emailVerifiedAt, birthDate, gender, profile.lastEducation, address, profile.city, profile.province, profile.avatar, profile.skills.length ? profile.skills : null, profile.experiences, jobApplications.some((application) => application.cvFile) ? true : null];
  const profileCompleteness = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100);
  let assignedStages = 0; let completedStages = 0;
  for (const application of jobApplications) {
    assignedStages += 1; completedStages += 1;
    if (application.job.hasPreSelectionTest && application.status !== "PENDING") { assignedStages += 1; if (application.testResult?.submittedAt) completedStages += 1; }
    if (application.interview) { assignedStages += 1; if (application.interview.status === "COMPLETED") completedStages += 1; }
  }
  const followThrough = assignedStages ? Math.round(completedStages / assignedStages * 100) : null;
  const assignedTests = jobApplications.filter((application) => application.job.hasPreSelectionTest && application.status !== "PENDING");
  const preSelectionCompletion = assignedTests.length ? Math.round(assignedTests.filter((application) => application.testResult?.submittedAt).length / assignedTests.length * 100) : null;
  const verifiedSkills = new Set(assessmentResults.filter((result) => result.isPassed).map((result) => result.assessment.skillName.toLowerCase()));
  const skillVerification = profile.skills.length ? Math.round(profile.skills.filter((skill) => verifiedSkills.has(skill.toLowerCase())).length / profile.skills.length * 100) : null;
  const qualityMetrics = [
    { key: "averageAssessment", label: "Average Assessment Score", value: averageAssessment, display: averageAssessment === null ? "—" : `${averageAssessment}%`, explanation: "Average score across completed skill assessments." },
    { key: "profileCompleteness", label: "Profile Completeness", value: profileCompleteness, display: `${profileCompleteness}%`, explanation: "Required profile fields and CV that have been completed." },
    { key: "applicationFollowThrough", label: "Application Follow-through", value: followThrough, display: followThrough === null ? "—" : `${followThrough}%`, explanation: "Assigned application stages that the applicant completed." },
    { key: "preSelectionCompletion", label: "Pre-selection Completion Rate", value: preSelectionCompletion, display: preSelectionCompletion === null ? "—" : `${preSelectionCompletion}%`, explanation: "Assigned pre-selection tests that were submitted." },
    { key: "skillVerification", label: "Skill Verification Rate", value: skillVerification, display: skillVerification === null ? "—" : `${skillVerification}%`, explanation: "Profile skills backed by a passed Polaris assessment." },
  ];
  const availableQuality = qualityMetrics.filter((metric) => metric.value !== null);
  const qualityScore = Math.min(100, Math.max(0, Math.round(availableQuality.reduce((sum, metric) => sum + metric.value!, 0) / availableQuality.length)));
  return {
    ...publicProfile,
    quality: { score: qualityScore, metrics: qualityMetrics },
    applicationInsights: {
      interviewResponseRate: totalApplications ? Math.round(interviews / totalApplications * 100) : 0,
      letterResponseRate: totalApplications ? Math.round(responses / totalApplications * 100) : 0,
      reliabilityRate: Math.max(0, 100 - reliabilityPenalty),
      appliedRoles: jobApplications.map((application) => application.job),
    },
  };
}
