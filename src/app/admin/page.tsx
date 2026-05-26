import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminPage() {
  const user = await requireRole("admin");
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Panel · Admin</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.email} — dashboard en construcción (Fase 6).
      </p>
    </main>
  );
}
