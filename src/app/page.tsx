import { redirect } from "next/navigation";
import { requireUser, homePathForRole } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();
  redirect(homePathForRole(user.role));
}
