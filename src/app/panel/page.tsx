import Link from "next/link";
import { Banknote, Coins, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId, getClientMovements } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { MovementsTable } from "@/components/movements-table";
import { cn } from "@/lib/utils";

export default async function PanelPage() {
  const user = await requireRole("user");
  const account = await getClientAccountByUserId(user.id);

  if (!account) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Tu cuenta aún no está configurada. Contacta a tu broker.
        </CardContent>
      </Card>
    );
  }

  const movements = await getClientMovements(account.id, 20);

  return (
    <div className="space-y-8">
      <Reveal>
        <Card className="glow-border relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary/20 blur-3xl" />
          <CardContent className="relative p-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" /> Saldo disponible
            </div>
            <p className="tabular mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatMXN(account.availableBalance)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Disponible para retiro por SPEI o conversión a USDT.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/panel/retiro" className={cn(buttonVariants({ size: "lg" }))}>
                <Banknote className="size-4" /> Retirar por SPEI
              </Link>
              <Link
                href="/panel/usdt"
                className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
              >
                <Coins className="size-4" /> Comprar USDT
              </Link>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementsTable movements={movements} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
