import { redirect } from "next/navigation";

import { homePathForRole } from "@/lib/nav";
import { getSessionUser } from "@/lib/server/auth";

export default async function Home() {
  // Role-specific landing: Admin -> daily task board; Owner/Superadmin -> Dashboard.
  const user = await getSessionUser();
  redirect(user ? homePathForRole(user.role) : "/login");
}
