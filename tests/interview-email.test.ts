import { afterEach, describe, expect, it } from "vitest";

import {
  dispatchEmails,
  sendInterviewScheduledEmail,
} from "../services/interview-management/interview-email.service.js";

const originalTimeZone = process.env.INTERVIEW_TIMEZONE;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.INTERVIEW_TIMEZONE;
  else process.env.INTERVIEW_TIMEZONE = originalTimeZone;
});

describe("interview email delivery", () => {
  it("reports a formatting failure without throwing from the interview request", async () => {
    process.env.INTERVIEW_TIMEZONE = "Invalid/Timezone";

    const delivery = sendInterviewScheduledEmail({
      applicantName: "Applicant",
      applicantEmail: "applicant@example.com",
      companyName: "Example Company",
      companyEmail: "company@example.com",
      jobTitle: "Engineer",
      interviewDate: new Date("2030-01-02T03:00:00.000Z"),
      locationOrLink: "Online",
    });

    await expect(dispatchEmails([delivery])).resolves.toBe(false);
  });
});
