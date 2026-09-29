import { ApiError } from "./api-error.js";

export type EmailLinkPurpose = "verification" | "passwordReset";

export const emailLinks = {
  verification: { label: "Verification", code: "VERIFICATION", minutes: 5 },
  passwordReset: { label: "Password reset", code: "PASSWORD_RESET", minutes: 60 },
} as const;

export function invalidEmailLink(purpose: EmailLinkPurpose) {
  const { label, code } = emailLinks[purpose];
  return new ApiError(
    `${label} link is invalid. It may have been used or replaced. Request a new link.`,
    400,
    `${code}_INVALID`,
  );
}

export function assertEmailLinkActive(purpose: EmailLinkPurpose, expiresAt: Date | null) {
  if (!expiresAt) throw invalidEmailLink(purpose);
  if (expiresAt.getTime() <= Date.now()) {
    const { label, code, minutes } = emailLinks[purpose];
    throw new ApiError(
      `${label} link has expired. This link is valid for ${minutes} minutes. Request a new link.`,
      400,
      `${code}_EXPIRED`,
    );
  }
}
