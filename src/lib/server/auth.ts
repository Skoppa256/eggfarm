import "server-only";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

// Auth / role enforcement (CLAUDE.md §5.5).
//
// A server action is a public endpoint, so role checks must run *inside* it — the
// first line of every mutating action is `await requireRole(...)`. UI hiding is
// never sufficient. The OWNER role is read-only and must be rejected by every
// write path.
//
// ⚠️ Slice 1 STUB. Auth (users, sessions, login) lands in Slice 2. The call sites
// and the role-check logic here are real; only the *source of the current user* is
// stubbed. Slice 2 replaces `requireUser`'s body with: read the signed session
// cookie → load the Session + User → reject if missing/expired/deactivated. Do NOT
// weaken the role logic when wiring that up.

export type Role = "SUPERADMIN" | "ADMIN" | "OWNER";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

// TODO: Slice 2 — remove this stub user once real sessions exist.
const STUB_USER: SessionUser = {
  id: "system",
  name: "System (Slice 1 stub)",
  role: "SUPERADMIN",
};

/**
 * Resolve the current authenticated user, or throw `UnauthorizedError`.
 *
 * TODO: Slice 2 — replace the stub with real session resolution.
 */
export async function requireUser(): Promise<SessionUser> {
  // TODO: Slice 2 — read cookie, load Session+User, throw UnauthorizedError if absent.
  const user = STUB_USER as SessionUser | null;
  if (!user) {
    throw new UnauthorizedError("Not authenticated.");
  }
  return user;
}

/**
 * Require the current user to hold one of `allowedRoles`, or throw
 * `ForbiddenError`. Pass the roles permitted to perform the write; OWNER must
 * never be among them on a write path.
 */
export async function requireRole(...allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Role ${user.role} is not permitted to perform this action.`,
    );
  }
  return user;
}
