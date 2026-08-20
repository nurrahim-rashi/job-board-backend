import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/prisma/enums.js";
import { ApiError } from "../utils/api-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";

const userSelect = { id: true, name: true, email: true, role: true, avatar: true } as const;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError("JWT_SECRET is not configured", 500);
  return secret;
}

function createAccessToken(user: { id: number; role: UserRole }) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret(), { expiresIn: "7d" });
}

function session(user: { id: number; name: string; email: string; role: UserRole; avatar: string | null }) {
  return { token: createAccessToken(user), user };
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new ApiError("Email is already registered", 409);

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password: await hashPassword(input.password) },
    select: userSelect,
  });
  return session(user);
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.password))) {
    throw new ApiError("Email or password is incorrect", 401);
  }

  return session(user);
}

export async function getAuthenticatedUser(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw new ApiError("User not found", 404);
  return user;
}
