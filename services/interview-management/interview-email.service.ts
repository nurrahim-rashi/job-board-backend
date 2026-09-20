import { sendEmail } from "../email.service.js";
import { buildPolarisEmail } from "../email-template.service.js";

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

const scheduleDetails = (context: InterviewEmailContext) => [
  { label: "Position", value: context.jobTitle },
  { label: "Company", value: context.companyName },
  {
    label: "Date and time",
    value: `${formatInterviewDate(context.interviewDate)} (${timeZone()})`,
  },
  {
    label: "Location or link",
    value: context.locationOrLink,
    ...(/^https?:\/\//i.test(context.locationOrLink)
      ? { url: context.locationOrLink }
      : {}),
  },
  ...(context.notes ? [{ label: "Notes", value: context.notes }] : []),
];

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
    html: buildPolarisEmail({
      preheader: `${context.companyName} scheduled an interview for ${context.jobTitle}.`,
      eyebrow: "Interview scheduled",
      title: "Your interview is booked",
      greeting: `Hi ${context.applicantName},`,
      message: `${context.companyName} has scheduled an interview with you.`,
      details: scheduleDetails(context),
      action: /^https?:\/\//i.test(context.locationOrLink)
        ? { label: "Open interview link", url: context.locationOrLink }
        : undefined,
      note: "Please be available a few minutes before the interview starts.",
    }),
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
    html: buildPolarisEmail({
      preheader: `Your interview details for ${context.jobTitle} were updated.`,
      eyebrow: "Schedule updated",
      title: "Your interview details changed",
      greeting: `Hi ${context.applicantName},`,
      message: `${context.companyName} has updated your interview details.`,
      details: scheduleDetails(context),
      action: /^https?:\/\//i.test(context.locationOrLink)
        ? { label: "Open interview link", url: context.locationOrLink }
        : undefined,
      note: "Please use this schedule instead of the previous one.",
    }),
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
    html: buildPolarisEmail({
      preheader: `The interview for ${context.jobTitle} has been cancelled.`,
      eyebrow: "Interview cancelled",
      title: "An interview update",
      greeting: `Hi ${context.applicantName},`,
      message: `${context.companyName} has cancelled the interview for ${context.jobTitle}.`,
      details: [{
        label: "Previous schedule",
        value: `${formatInterviewDate(context.interviewDate)} (${timeZone()})`,
      }],
      note: "You will be contacted again if the interview is rescheduled.",
    }),
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
    html: buildPolarisEmail({
      preheader: `Your interview for ${context.jobTitle} is tomorrow.`,
      eyebrow: "Interview reminder",
      title: "Your interview is tomorrow",
      greeting: `Hi ${context.applicantName},`,
      message: "Here is a reminder for your upcoming interview.",
      details: scheduleDetails(context),
      action: /^https?:\/\//i.test(context.locationOrLink)
        ? { label: "Open interview link", url: context.locationOrLink }
        : undefined,
      note: "Good luck — you have got this.",
    }),
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
    html: buildPolarisEmail({
      preheader: `Interview with ${context.applicantName} is tomorrow.`,
      eyebrow: "Company reminder",
      title: "An interview is coming up",
      greeting: "Hello,",
      message: `You have an upcoming interview with ${context.applicantName} (${context.applicantEmail}).`,
      details: scheduleDetails(context),
      action: /^https?:\/\//i.test(context.locationOrLink)
        ? { label: "Open interview link", url: context.locationOrLink }
        : undefined,
    }),
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
