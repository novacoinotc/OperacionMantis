import { desc, eq } from "drizzle-orm";
import { Percent } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { brokerPayouts } from "@/db/schema";
import { getBrokerAccrued, getPendingPayout } from "@/lib/services/payouts";
import { getBrokerStats } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { formatDateTime, statusLabel, statusVariant } from "@/lib/ui";
import { StatCard } from "@/components/stat-card";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayoutForm } from "./payout-form";

export const metadata = { title: "Comisiones" };

export default async function BrokerComisionesPage() {
  const broker = await requireRole("broker");
  const [stats, accrued, pending, history] = await Promise.all([
    getBrokerStats(broker.id),
    getBrokerAccrued(broker.id),
    getPendingPayout(broker.id),
    db
      .select()
      .from(brokerPayouts)
      .where(eq(brokerPayouts.brokerUserId, broker.id))
      .orderBy(desc(brokerPayouts.createdAt))
      .limit(50),
  ]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Por cobrar (acumulado)"
            value={formatMXN(accrued)}
            icon={Percent}
            accent="success"
          />
          <StatCard label="Pagado histórico" value={formatMXN(stats.commissionPaid)} icon={Percent} />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobrar comisiones</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutForm accrued={accrued} hasPending={Boolean(pending)} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de cobros</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin cobros todavía.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </TableCell>
                      <TableCell className="uppercase">{p.method}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatMXN(p.amount)}
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
