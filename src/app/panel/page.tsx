import Link from "next/link";
import { Banknote, Coins, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId, getClientMovements } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { MovementsTable } from "@/components/movements-table";
import { CopyButton } from "@/components/copy-button";
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

  const movements = await getClientMovements(account.id, { limit: 20 });

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

      {account.depositClabes && account.depositClabes.length > 0 ? (
        <Reveal delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tus CLABEs para recibir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Comparte cualquiera de estas CLABEs para recibir pagos. Todo lo que entre suma a tu
                saldo disponible.
              </p>
              {account.depositClabes.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <span className="tabular text-sm">{c}</span>
                  <CopyButton value={c} label="Copiar CLABE" />
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={0.15}>
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
