"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama pengguna
        <input name="username" autoComplete="username" required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kata Sandi
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Masuk…" : "Masuk"}
      </button>
    </form>
  );
}
