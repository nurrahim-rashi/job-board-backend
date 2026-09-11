import { prisma } from "../../lib/prisma.js";
import { zonedDayStart } from "../../utils/interview.util.js";
import {
  InterviewEmailContext,
  interviewTimeZone,
  sendAdminReminderEmail,
  sendApplicantReminderEmail,
} from "./interview-email.service.js";

export const sendInterviewRemindersService = async (now = new Date()) => {
  const timeZone = interviewTimeZone();
  const tomorrow = zonedDayStart(now, timeZone, 1);
  const dayAfterTomorrow = zonedDayStart(now, timeZone, 2);

  const interviews = await prisma.interview.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      interviewDate: { gte: tomorrow, lt: dayAfterTomorrow },
    },
    orderBy: { interviewDate: "asc" },
    include: {
      jobApplication: {
        select: {
          user: { select: { name: true, email: true } },
          job: {
            select: {
              title: true,
              company: {
                select: {
                  companyName: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const interview of interviews) {
    const { user, job } = interview.jobApplication;

    const context: InterviewEmailContext = {
      applicantName: user.name,
      applicantEmail: user.email,
      companyName: job.company.companyName,
      companyEmail: job.company.user.email,
      jobTitle: job.title,
      interviewDate: interview.interviewDate,
      locationOrLink: interview.locationOrLink,
      notes: interview.notes,
    };

    try {
      await sendApplicantReminderEmail(context);
      await sendAdminReminderEmail(context).catch((error) =>
        console.error("Unable to deliver admin interview reminder", error),
      );

      await prisma.interview.update({
        where: { id: interview.id },
        data: { reminderSentAt: new Date() },
      });

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Unable to deliver interview reminder ${interview.id}`,
        error,
      );
    }
  }

  return { found: interviews.length, sent, failed };
};
