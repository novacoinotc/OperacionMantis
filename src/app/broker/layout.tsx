import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function BrokerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("broker");
  return (
    <div className="min-h-dvh">
      <TopNav
        user={{ name: user.name, email: user.email, role: user.role }}
        items={[
          { href: "/broker", label: "Inicio" },
          { href: "/broker/clientes", label: "Clientes" },
          { href: "/broker/comisiones", label: "Comisiones" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
