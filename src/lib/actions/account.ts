"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const schema = z.object({
  current: z.string().min(1, "Ingresa tu contraseña actual."),
  next: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export type PwState = { error?: string; success?: string } | null;

export async function changePasswordAction(_prev: PwState, formData: FormData): Promise<PwState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  if (!verifyPassword(parsed.data.current, user.passwordHash)) {
    return { error: "Tu contraseña actual es incorrecta." };
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { success: "Contraseña actualizada correctamente." };
}
