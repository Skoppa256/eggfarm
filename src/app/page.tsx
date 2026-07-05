import { redirect } from "next/navigation";

export default function Home() {
  // The dashboard is every role's landing (the Owner's home; SRS §3.8 / UC-03).
  redirect("/dashboard");
}
