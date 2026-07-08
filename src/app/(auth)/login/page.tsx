import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk · EggFarm IMS" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 p-8 dark:border-zinc-800">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">EggFarm IMS</h1>
        <p className="mb-6 text-sm text-zinc-500">Masuk untuk melanjutkan.</p>
        <LoginForm />
      </div>
    </main>
  );
}
