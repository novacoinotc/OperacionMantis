import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return (
    <div className="min-h-dvh">
      <TopNav
        user={{ name: user.name, email: user.email, role: user.role }}
        items={[
          { href: "/admin", label: "Resumen" },
          { href: "/admin/depositos", label: "Depósitos" },
          { href: "/admin/retiros", label: "Retiros" },
          { href: "/admin/usdt", label: "USDT" },
          { href: "/admin/comisiones", label: "Comisiones" },
          { href: "/admin/cuentas", label: "Cuentas" },
          { href: "/admin/usuarios", label: "Usuarios" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
