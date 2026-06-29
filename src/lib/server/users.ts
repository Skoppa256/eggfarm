import "server-only";

import { RecordStatus, type Role } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

// User management service (Superadmin-only at the action layer). Plain functions —
// the role gate lives in the server actions (CLAUDE.md §5.5), so these stay
// testable in isolation.

const SAFE_FIELDS = {
  id: true,
  name: true,
  username: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export function listUsers() {
  return prisma.user.findMany({
    select: SAFE_FIELDS,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
  role: Role;
}) {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ConflictError(`Username "${input.username}" is already taken.`);
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      passwordHash,
      role: input.role,
    },
    select: SAFE_FIELDS,
  });
}

/**
 * Activate or deactivate a user (soft — never hard-delete, CLAUDE.md §6).
 * Deactivating also deletes the user's sessions so the lockout is immediate.
 */
export async function setUserStatus(userId: string, status: RecordStatus) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found.");
  }
  if (status === RecordStatus.INACTIVE) {
    await prisma.session.deleteMany({ where: { userId } });
  }
  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: SAFE_FIELDS,
  });
}
