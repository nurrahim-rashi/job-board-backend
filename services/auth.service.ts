import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { AuthProvider, UserRole } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeRichText } from "../lib/sanitize-html.js";
import { ApiError } from "../utils/api-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { createOneTimeToken, hashToken } from "../utils/token.js";
import { sendEmail } from "./email.service.js";
import { buildPolarisEmail } from "./email-template.service.js";
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "../validators/auth.validator.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  emailVerifiedAt: true,
  birthDate: true,
  gender: true,
  lastEducation: true,
  address: true,
  city: true,
  province: true,
  country: true,
  professionalRole: true,
  availability: true,
  profileIntro: true,
  salaryExpectation: true,
  salaryExpectationCurrency: true,
  profileStory: true,
  skills: true,
  profileLinks: true,
  experiences: true,
  selectedWork: true,
  isPublicProfile: true,
  authProvider: true,
  company: {
    select: {
      id: true,
      companyName: true,
      phone: true,
      profileContent: true,
      tagline: true,
      size: true,
      founded: true,
      website: true,
      products: true,
      values: true,
      perks: true,
      logo: true,
      banner: true,
      city: true,
      province: true,
      country: true,
    },
  },
} as const;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError("JWT_SECRET is not configured", 500);
  return secret;
}

function createAccessToken(user: { id: number; role: UserRole }) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret(), {
    expiresIn: "7d",
  });
}

function session(user: { id: number; role: UserRole }) {
  return { token: createAccessToken(user), user };
}

function frontendUrl(path: string, token: string) {
  return `${process.env.FRONTEND_URL ?? "http://localhost:5173"}${path}?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail(userId: number, email: string) {
  const { token, hash } = createOneTimeToken();
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const verificationUrl = frontendUrl("/verify-email", token);
  await sendEmail({
    to: email,
    subject: "Verify your Polaris email",
    text: `Verify your email within one hour: ${verificationUrl}`,
    html: buildPolarisEmail({
      preheader: "Verify your email address to finish setting up Polaris.",
      eyebrow: "Email verification",
      title: "Confirm your email",
      message: "One quick step remains before your Polaris account is ready. This secure link expires in one hour.",
      action: { label: "Verify email", url: verificationUrl },
      note: "If you did not create or update a Polaris account, you can safely ignore this email.",
    }),
  });
}

export async function registerUser(input: RegisterInput) {
  jwtSecret();
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingUser) throw new ApiError("Email is already registered", 409);
  const password = await hashPassword(input.password);
  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        password,
        role: input.role,
        authProvider: AuthProvider.EMAIL,
      },
      select: userSelect,
    });
    if (input.role === UserRole.COMPANY_ADMIN) {
      await transaction.company.create({
        data: {
          userId: created.id,
          companyName: input.companyName!,
          phone: input.phone!,
          // Location is completed later from the company profile editor.
          city: "",
          profileContent: "",
        },
      });
    }
    return created;
  });
  try {
    await sendVerificationEmail(user.id, user.email);
  } catch (err) {
    console.error("Verification email failed for", user.email, err);
  }
  return session(await getAuthenticatedUser(user.id));
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (
    !user ||
    !user.password ||
    !(await verifyPassword(input.password, user.password))
  ) {
    throw new ApiError("Email or password is incorrect", 401);
  }
  return session(await getAuthenticatedUser(user.id));
}

export async function loginWithGoogle(credential: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError("Google Sign-In is not configured", 503);

  let ticket;
  try {
    ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
  } catch {
    throw new ApiError("Google credential is invalid or has expired", 401);
  }
  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();

  if (!email || !payload?.email_verified || !payload.name) {
    throw new ApiError("Google account could not be verified", 401);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.authProvider === AuthProvider.EMAIL) {
    throw new ApiError(
      "This email uses password login. Sign in with your email and password.",
      409,
    );
  }

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: payload.name,
          avatar: existingUser.avatar || payload.picture || null,
          emailVerifiedAt: existingUser.emailVerifiedAt || new Date(),
        },
        select: userSelect,
      })
    : await prisma.user.create({
        data: {
          name: payload.name,
          email,
          avatar: payload.picture || null,
          role: UserRole.JOB_SEEKER,
          authProvider: AuthProvider.GOOGLE,
          emailVerifiedAt: new Date(),
        },
        select: userSelect,
      });

  return session(user);
}

export async function getAuthenticatedUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) throw new ApiError("User not found", 404);
  return user;
}

export async function getSubscriptionStatus(userId: number) {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endDate: { gte: new Date() },
    },
    select: {
      id: true,
      subscription: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    active: Boolean(subscription),
    plan: subscription?.subscription.name ?? null,
  };
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { gt: new Date() },
    },
  });
  if (!user)
    throw new ApiError("Verification link is invalid or has expired", 400);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });
}

export async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  if (user.emailVerifiedAt)
    throw new ApiError("Email is already verified", 400);
  await sendVerificationEmail(user.id, user.email);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.authProvider !== AuthProvider.EMAIL) return;
  const { token, hash } = createOneTimeToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const resetUrl = frontendUrl("/reset-password/confirm", token);
  await sendEmail({
    to: user.email,
    subject: "Reset your Polaris password",
    text: `Reset your password within one hour: ${resetUrl}`,
    html: buildPolarisEmail({
      preheader: "Use this secure link to reset your Polaris password.",
      eyebrow: "Account security",
      title: "Reset your password",
      message: "We received a request to reset your Polaris password. The secure link below expires in one hour.",
      action: { label: "Reset password", url: resetUrl },
      note: "If you did not request a password reset, no action is needed and your password will remain unchanged.",
    }),
  });
}

export async function resetPassword(token: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: { gt: new Date() },
      authProvider: AuthProvider.EMAIL,
    },
  });
  if (!user) throw new ApiError("Reset link is invalid or has expired", 400);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!current) throw new ApiError("User not found", 404);
  if (
    input.email &&
    input.email !== current.email &&
    (await prisma.user.findUnique({ where: { email: input.email } }))
  )
    throw new ApiError("Email is already registered", 409);
  const {
    companyName,
    phone,
    profileContent,
    companyCity,
    companyProvince,
    companyCountry,
    companyTagline,
    companySize,
    companyFounded,
    companyWebsite,
    companyProducts,
    companyValues,
    companyPerks,
    ...userData
  } = input;
  const emailChanged = Boolean(
    userData.email && userData.email !== current.email,
  );
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        ...userData,
        ...(emailChanged
          ? {
              emailVerifiedAt: null,
              emailVerificationTokenHash: null,
              emailVerificationExpiresAt: null,
            }
          : {}),
      },
    });
    if (
      current.role === UserRole.COMPANY_ADMIN &&
      (companyName ||
        phone ||
        profileContent !== undefined ||
        companyCity ||
        companyProvince !== undefined ||
        companyCountry !== undefined ||
        companyTagline !== undefined ||
        companySize !== undefined ||
        companyFounded !== undefined ||
        companyWebsite !== undefined ||
        companyProducts !== undefined ||
        companyValues !== undefined ||
        companyPerks !== undefined)
    ) {
      await transaction.company.update({
        where: { userId },
        data: {
          ...(companyName ? { companyName } : {}),
          ...(phone ? { phone } : {}),
          ...(profileContent !== undefined
            ? { profileContent: sanitizeRichText(profileContent) }
            : {}),
          ...(companyCity ? { city: companyCity } : {}),
          ...(companyProvince !== undefined
            ? { province: companyProvince }
            : userData.province !== undefined
              ? { province: userData.province }
              : {}),
          ...(companyCountry !== undefined
            ? { country: companyCountry }
            : {}),
          ...(companyTagline !== undefined ? { tagline: companyTagline } : {}),
          ...(companySize !== undefined ? { size: companySize } : {}),
          ...(companyFounded !== undefined ? { founded: companyFounded } : {}),
          ...(companyWebsite !== undefined ? { website: companyWebsite } : {}),
          ...(companyProducts !== undefined ? { products: companyProducts } : {}),
          ...(companyValues !== undefined ? { values: companyValues } : {}),
          ...(companyPerks !== undefined ? { perks: companyPerks } : {}),
        },
        select: { id: true },
      });
    }
  });
  const updated = await getAuthenticatedUser(userId);
  if (emailChanged) await sendVerificationEmail(userId, updated.email);
  return updated;
}

export async function updateCompanyMedia(
  userId: number,
  field: "logo" | "banner",
  url: string | null,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== UserRole.COMPANY_ADMIN) {
    throw new ApiError("Only company admins can update company media", 403);
  }
  await prisma.company.update({
    where: { userId },
    data: { [field]: url },
    select: { id: true },
  });
  return getAuthenticatedUser(userId);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.password || user.authProvider !== AuthProvider.EMAIL)
    throw new ApiError(
      "Password is managed by your social login provider",
      400,
    );
  if (!(await verifyPassword(currentPassword, user.password)))
    throw new ApiError("Current password is incorrect", 400);
  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword) },
  });
}

export async function updateAvatar(userId: number, avatar: string | null) {
  await prisma.user.update({ where: { id: userId }, data: { avatar } });
  return getAuthenticatedUser(userId);
}
