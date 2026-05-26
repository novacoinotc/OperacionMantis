"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export type NavItem = { href: string; label: string };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  broker: "Broker",
  user: "Cliente",
};

export function TopNav({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string | null; email: string; role: string };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-3 text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="tracking-tight">Mantis</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {items.map((it) => {
            const active =
              pathname === it.href || (it.href !== "/" && pathname.startsWith(`${it.href}/`));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "rounded-md px-3 py-1.5 whitespace-nowrap transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/cuenta"
            className="hidden text-right transition-opacity hover:opacity-80 sm:block"
            title="Mi cuenta · cambiar contraseña"
          >
            <div className="text-sm leading-tight font-medium">{user.name ?? user.email}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</div>
          </Link>
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Salir
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
