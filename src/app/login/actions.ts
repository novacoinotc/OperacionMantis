"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, homePathForRole } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | null;

const LOCK_THRESHOLD = 8; // intentos fallidos antes de bloquear
const LOCK_MINUTES = 15; // duración del bloqueo

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

  // Usuario inexistente/inactivo: quema cómputo similar para no filtrar por tiempo.
  if (!user || !user.isActive || !user.passwordHash) {
    hashPassword(password);
    return { error: "Credenciales incorrectas." };
  }

  // Bloqueo temporal por intentos fallidos.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { error: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await db
      .update(users)
      .set({ failedLoginAttempts: attempts, lockedUntil: locked })
      .where(eq(users.id, user.id));
    return { error: "Credenciales incorrectas." };
  }

  // Éxito: limpia el contador si hacía falta.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
  }

  await createSession(user.id);

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login");
  redirect(safeNext ? next : homePathForRole(user.role));
}
