import { buildPolarisEmail } from "../email-template.service.js";
import { sendEmail } from "../email.service.js";

export type ApplicantDecisionContext = {
  applicantName: string;
  applicantEmail: string;
  companyName: string;
  jobTitle: string;
  rejectionReason?: string | null;
};

const frontendUrl = (path: string) =>
  `${(process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "")}${path}`;

const roleDetails = (context: ApplicantDecisionContext) => [
  { label: "Position", value: context.jobTitle },
  { label: "Company", value: context.companyName },
];

export const sendApplicantAcceptedEmail = async (
  context: ApplicantDecisionContext,
) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `You have been accepted for ${context.jobTitle}`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      `${context.companyName} has accepted your application for ${context.jobTitle}.`,
      "The company will contact you about the next steps.",
      "",
      `Track your application: ${frontendUrl("/dashboard/applications")}`,
    ].join("\n"),
    html: buildPolarisEmail({
      preheader: `${context.companyName} accepted your application for ${context.jobTitle}.`,
      eyebrow: "Application accepted",
      title: "Congratulations, you got the role",
      greeting: `Hi ${context.applicantName},`,
      message: `${context.companyName} has accepted your application. The company will contact you about the next steps.`,
      details: roleDetails(context),
      action: { label: "View my applications", url: frontendUrl("/dashboard/applications") },
      note: "Keep an eye on your inbox. The company will send the offer details separately.",
    }),
  });

export const sendApplicantRejectedEmail = async (
  context: ApplicantDecisionContext,
) =>
  sendEmail({
    to: context.applicantEmail,
    subject: `Update on your application for ${context.jobTitle}`,
    text: [
      `Hi ${context.applicantName},`,
      "",
      `${context.companyName} has decided not to move forward with your application for ${context.jobTitle}.`,
      ...(context.rejectionReason ? ["", `Reason: ${context.rejectionReason}`] : []),
      "",
      `Track your application: ${frontendUrl("/dashboard/applications")}`,
    ].join("\n"),
    html: buildPolarisEmail({
      preheader: `An update on your application for ${context.jobTitle}.`,
      eyebrow: "Application update",
      title: "Your application was not selected",
      greeting: `Hi ${context.applicantName},`,
      message: `${context.companyName} has decided not to move forward with your application this time. The feedback from the company is below.`,
      details: [
        ...roleDetails(context),
        ...(context.rejectionReason ? [{ label: "Reason", value: context.rejectionReason }] : []),
      ],
      action: { label: "Find other jobs", url: frontendUrl("/jobs") },
      note: "Your profile and CV stay on Polaris, so you can apply to other roles any time.",
    }),
  });
