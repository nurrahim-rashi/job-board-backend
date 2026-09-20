import { sendEmail } from "../email.service.js";

export type InterviewEmailContext = {
  applicantName: string;
  applicantEmail: string;
  companyName: string;
  companyEmail: string;
  jobTitle: string;
  interviewDate: Date;
  locationOrLink: string;
  notes?: string | null;
};

export const interviewTimeZone = () =>
  process.env.INTERVIEW_TIMEZONE ?? "Asia/Jakarta";

const timeZone = interviewTimeZone;

export const formatInterviewDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timeZone(),
  }).format(date);

const scheduleLines = (context: InterviewEmailContext) =>
  [
    `Position: ${context.jobTitle}`,
    `Company: ${context.companyName}`,
    `Date and time: ${formatInterviewDate(context.interviewDate)} (${timeZone()})`,
    `Location or link: ${context.locationOrLink}`,
    ...(context.notes ? [`Notes: ${context.notes}`] : []),
  ].join("\n");

export const sendInterviewScheduledEmail = (context: InterviewEmailContext) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `Interview schedule for ${context.jobTitle}`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      `${context.companyName} has scheduled an interview with you.`,
      "",
      scheduleLines(context),
      "",
      "Please be available a few minutes before the interview starts.",
    ].join("\n"),
  });

export const sendInterviewUpdatedEmail = (context: InterviewEmailContext) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `Updated interview schedule for ${context.jobTitle}`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      `${context.companyName} has updated your interview details.`,
      "",
      scheduleLines(context),
      "",
      "Please use this schedule instead of the previous one.",
    ].join("\n"),
  });

export const sendInterviewCancelledEmail = (context: InterviewEmailContext) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `Interview cancelled for ${context.jobTitle}`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      `${context.companyName} has cancelled the interview scheduled on ${formatInterviewDate(context.interviewDate)} (${timeZone()}).`,
      "",
      "You will be contacted again if the interview is rescheduled.",
    ].join("\n"),
  });

export const sendApplicantReminderEmail = (context: InterviewEmailContext) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `Reminder: interview for ${context.jobTitle} tomorrow`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      "This is a reminder for your upcoming interview.",
      "",
      scheduleLines(context),
      "",
      "Good luck!",
    ].join("\n"),
  });

export const sendAdminReminderEmail = (context: InterviewEmailContext) =>
  sendEmail({
    to: context.companyEmail,
    subject: `Reminder: interview with ${context.applicantName} tomorrow`,
    text: [
      "Hello,",
      "",
      `You have an upcoming interview with ${context.applicantName} (${context.applicantEmail}).`,
      "",
      scheduleLines(context),
    ].join("\n"),
  });

export const dispatchEmails = async (deliveries: Promise<unknown>[]) => {
  const results = await Promise.allSettled(deliveries);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Unable to deliver interview email", result.reason);
    }
  }

  return results.every((result) => result.status === "fulfilled");
};
