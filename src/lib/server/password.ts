import "server-only";

import bcrypt from "bcryptjs";

// Password hashing (CLAUDE.md §3). bcryptjs is a pure-JS bcrypt implementation —
// same algorithm and hash format ($2…) as native bcrypt, without a native build
// step (which pnpm skips by default). Server-only: never bundle into the client.

const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
