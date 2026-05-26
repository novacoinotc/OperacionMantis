import { Banknote, Clock, Landmark, Percent, TrendingUp, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAdminAccounts, getAdminOverview } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { StatCard } from "@/components/stat-card";
import { Reveal } from "@/components/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminPage() {
  await requireRole("admin");
  const [ov, accounts] = await Promise.all([getAdminOverview(), getAdminAccounts()]);
  const margin = ov.deposits.commission - ov.brokerPayable;

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Depósitos brutos"
            value={formatMXN(ov.deposits.gross)}
            sub={`${ov.deposits.count} depósito(s)`}
            icon={Banknote}
            accent="primary"
          />
          <StatCard label="Comisión 4%" value={formatMXN(ov.deposits.commission)} icon={Percent} accent="success" />
          <StatCard
            label="Por pagar a brokers"
            value={formatMXN(ov.brokerPayable)}
            icon={Percent}
            accent="warning"
          />
          <StatCard label="Margen neto" value={formatMXN(margin)} icon={TrendingUp} accent="success" />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Saldo de clientes (neto)"
            value={formatMXN(ov.ledger.client_available ?? 0)}
            icon={Wallet}
          />
          <StatCard label="Efectivo en core" value={formatMXN(ov.ledger.core_cash ?? 0)} icon={Landmark} />
          <StatCard
            label="Retiros pendientes"
            value={String(ov.pendingWithdrawals)}
            icon={Clock}
            accent="warning"
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuentas de clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin cuentas todavía.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CLABE</TableHead>
                    <TableHead className="text-right">Saldo neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.accountId}>
                      <TableCell>
                        <div className="font-medium">{a.clientName ?? a.clientEmail}</div>
                        <div className="text-xs text-muted-foreground">{a.label ?? a.clientEmail}</div>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">{a.clabe ?? "—"}</TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatMXN(a.availableBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
