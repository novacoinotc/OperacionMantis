import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getSessionUserId } from "./session";

/** Usuario autenticado actual (cargado de la DB), o null. Memoizado por request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = await getSessionUserId();
  if (!id) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u || !u.isActive) return null;
  return u;
});

/** Exige sesión; si no hay, redirige a /login. */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** Exige uno de los roles dados; si no, redirige al home (que enruta por rol). */
export async function requireRole(...roles: User["role"][]): Promise<User> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/");
  return u;
}

/** Ruta del dashboard según rol. */
export function homePathForRole(role: User["role"]): string {
  if (role === "admin") return "/admin";
  if (role === "broker") return "/broker";
  return "/panel";
}

export { createSession, destroySession } from "./session";
