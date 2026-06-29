"use client";

import { useActionState } from "react";

import { Role } from "@/generated/prisma/enums";
import { createUserAction, type UserActionResult } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  OWNER: "Owner (read-only)",
};

export function UserCreateForm() {
  const [state, action, pending] = useActionState<UserActionResult | null, FormData>(
    createUserAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Username
          <input name="username" autoComplete="off" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Role
          <select name="role" defaultValue={Role.ADMIN} className={fieldClass}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create user
        </button>
        {state && !state.ok && (
          <span role="alert" className="text-sm font-medium text-rose-600">
            {state.error}
          </span>
        )}
        {state && state.ok && (
          <span role="status" className="text-sm font-medium text-emerald-600">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
