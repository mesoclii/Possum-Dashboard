import { redirect } from "next/navigation";

export default function ServerSetupPage() {
  redirect("/dashboard/infrastructure");
}
