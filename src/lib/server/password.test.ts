import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/server/password";

describe("password", () => {
  it("hashes to a bcrypt string and verifies the original", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
