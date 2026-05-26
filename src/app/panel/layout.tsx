import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("user");
  return (
    <div className="min-h-dvh">
      <TopNav
        user={{ name: user.name, email: user.email, role: user.role }}
        items={[
          { href: "/panel", label: "Inicio" },
          { href: "/panel/retiro", label: "Retirar SPEI" },
          { href: "/panel/usdt", label: "Comprar USDT" },
          { href: "/panel/movimientos", label: "Movimientos" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
