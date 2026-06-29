import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { RecordStatus, Role } from "@/generated/prisma/enums";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";

// Auth + role enforcement (CLAUDE.md §5.5).
//
// A server action is a public endpoint, so role checks run *inside* it — the first
// line of every mutating action is `await requireRole(...)`. UI hiding is never
// sufficient. OWNER is read-only and rejected on every write path.
//
// Sessions are DB-backed: a signed httpOnly cookie (jose) carries only the session
// id; the `Session` row is the source of truth. Every request re-loads the row and
// the user, so logout or deactivation locks a user out immediately.

export { Role } from "@/generated/prisma/enums";

const COOKIE_NAME = "eggfarm_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — cannot sign/verify sessions.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verify credentials and return the user (no session created yet). Throws
 * `UnauthorizedError` for unknown user, wrong password, or a deactivated account —
 * so a deactivated user can never log in.
 */
export async function authenticate(username: string, password: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { username } });
  // Same error whether the user is missing, inactive, or the password is wrong —
  // don't leak which usernames exist.
  if (!user || user.status !== RecordStatus.ACTIVE) {
    throw new UnauthorizedError("Invalid username or password.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid username or password.");
  }
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

/** Create a Session row and set the signed httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({ data: { userId, expiresAt } });

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

/** Resolve the current user from the cookie + DB session, or null if not valid. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let sessionId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sid !== "string") return null;
    sessionId = payload.sid;
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  const { user } = session;
  if (user.status !== RecordStatus.ACTIVE) return null;

  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

/** Delete the current session row and clear the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      if (typeof payload.sid === "string") {
        await prisma.session.deleteMany({ where: { id: payload.sid } });
      }
    } catch {
      // ignore an unverifiable token — we're clearing it anyway
    }
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Require an authenticated user, or throw `UnauthorizedError`. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError("Not authenticated.");
  }
  return user;
}

/**
 * Pure role check (no I/O), so it is unit-testable. Throws `ForbiddenError` if the
 * user's role is not in `allowedRoles`. OWNER must never be in the allow-list of a
 * write path.
 */
export function assertRole(user: { role: Role }, allowedRoles: Role[]): void {
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Role ${user.role} is not permitted to perform this action.`);
  }
}

/** Require an authenticated user holding one of `allowedRoles`. */
export async function requireRole(...allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  assertRole(user, allowedRoles);
  return user;
}
