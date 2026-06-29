import { redirect } from "next/navigation";

export default function Home() {
  // Slice 1 has a single screen. Auth + a real landing/dashboard arrive later.
  redirect("/warehouse");
}
