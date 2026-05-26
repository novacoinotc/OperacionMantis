"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, homePathForRole } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: "Correo o contraseña inválidos." };

  const { email, password, next } = parsed.data;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { error: "Credenciales incorrectas." };
  }

  await createSession(user.id);

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login");
  redirect(safeNext ? next : homePathForRole(user.role));
}
