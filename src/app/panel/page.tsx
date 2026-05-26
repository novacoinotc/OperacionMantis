import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function PanelPage() {
  const user = await requireRole("user");
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mi saldo</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.email} — dashboard en construcción (Fase 6).
      </p>
    </main>
  );
}
