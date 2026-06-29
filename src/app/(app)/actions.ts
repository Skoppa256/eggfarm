"use server";

import { redirect } from "next/navigation";

import { destroySession } from "@/lib/server/auth";

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
