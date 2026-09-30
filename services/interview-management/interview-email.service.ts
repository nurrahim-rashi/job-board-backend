import { buildPolarisEmail } from "../email-template.service.js";
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

const isLink = (value: string) => /^https?:\/\//i.test(value.trim());

const scheduleDetails = (context: InterviewEmailContext) => [
  { label: "Position", value: context.jobTitle },
  { label: "Company", value: context.companyName },
  { label: "Date and time", value: `${formatInterviewDate(context.interviewDate)} (${timeZone()})` },
  {
    label: "Location or link",
    value: context.locationOrLink,
    ...(isLink(context.locationOrLink) && { url: context.locationOrLink.trim() }),
  },
  ...(context.notes ? [{ label: "Notes", value: context.notes }] : []),
];

type InterviewEmail = {
  to: string;
  subject: string;
  eyebrow: string;
  title: string;
  greeting: string;
  message: string;
  details: { label: string; value: string; url?: string }[];
  note?: string;
};

const sendInterviewEmail = (email: InterviewEmail) =>
  sendEmail({
    to: email.to,
    subject: email.subject,
    text: [
      email.greeting,
      "",
      email.message,
      "",
      ...email.details.map((detail) => `${detail.label}: ${detail.value}`),
      ...(email.note ? ["", email.note] : []),
    ].join("\n"),
    html: buildPolarisEmail({
      preheader: email.message,
      eyebrow: email.eyebrow,
      title: email.title,
      greeting: email.greeting,
      message: email.message,
      details: email.details,
      note: email.note,
    }),
  });

export const sendInterviewScheduledEmail = async (
  context: InterviewEmailContext,
) =>
  sendInterviewEmail({
    to: context.applicantEmail,
    subject: `Interview schedule for ${context.jobTitle}`,
    eyebrow: "Interview invitation",
    title: "You are invited to an interview",
    greeting: `Hi ${context.applicantName},`,
    message: `${context.companyName} has scheduled an interview with you.`,
    details: scheduleDetails(context),
    note: "Please be available a few minutes before the interview starts.",
  });

export const sendInterviewUpdatedEmail = async (
  context: InterviewEmailContext,
) =>
  sendInterviewEmail({
    to: context.applicantEmail,
    subject: `Updated interview schedule for ${context.jobTitle}`,
    eyebrow: "Interview rescheduled",
    title: "Your interview details changed",
    greeting: `Hi ${context.applicantName},`,
    message: `${context.companyName} has updated your interview details.`,
    details: scheduleDetails(context),
    note: "Please use this schedule instead of the previous one.",
  });

export const sendInterviewCancelledEmail = async (
  context: InterviewEmailContext,
) =>
  sendInterviewEmail({
    to: context.applicantEmail,
    subject: `Interview cancelled for ${context.jobTitle}`,
    eyebrow: "Interview cancelled",
    title: "Your interview was cancelled",
    greeting: `Hi ${context.applicantName},`,
    message: `${context.companyName} has cancelled the interview below.`,
    details: scheduleDetails(context).filter((detail) => detail.label !== "Notes"),
    note: "You will be contacted again if the interview is rescheduled.",
  });

export const sendApplicantReminderEmail = async (
  context: InterviewEmailContext,
) =>
  sendInterviewEmail({
    to: context.applicantEmail,
    subject: `Reminder: interview for ${context.jobTitle} tomorrow`,
    eyebrow: "Interview reminder",
    title: "Your interview is tomorrow",
    greeting: `Hi ${context.applicantName},`,
    message: "This is a reminder for your upcoming interview.",
    details: scheduleDetails(context),
    note: "Good luck!",
  });

export const sendAdminReminderEmail = async (
  context: InterviewEmailContext,
) =>
  sendInterviewEmail({
    to: context.companyEmail,
    subject: `Reminder: interview with ${context.applicantName} tomorrow`,
    eyebrow: "Interview reminder",
    title: `Interview with ${context.applicantName} tomorrow`,
    greeting: "Hello,",
    message: `You have an upcoming interview with ${context.applicantName} (${context.applicantEmail}).`,
    details: scheduleDetails(context),
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
