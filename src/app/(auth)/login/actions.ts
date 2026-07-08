"use server";

import { redirect } from "next/navigation";

import { AppError } from "@/lib/errors";
import { loginSchema } from "@/lib/schemas/auth";
import { authenticate, createSession } from "@/lib/server/auth";

export type LoginState = { error: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  try {
    const user = await authenticate(parsed.data.username, parsed.data.password);
    await createSession(user.id);
  } catch (err) {
    if (err instanceof AppError) {
      return { error: err.message };
    }
    throw err;
  }

  // Outside the try/catch so redirect's control-flow signal isn't swallowed.
  redirect("/warehouse");
}
