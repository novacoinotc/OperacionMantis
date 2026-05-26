import { Percent, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getBrokerClients, getBrokerStats } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { StatCard } from "@/components/stat-card";
import { Reveal } from "@/components/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BrokerPage() {
  const user = await requireRole("broker");
  const [stats, clients] = await Promise.all([
    getBrokerStats(user.id),
    getBrokerClients(user.id),
  ]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Clientes" value={String(stats.clientCount)} icon={Users} accent="primary" />
          <StatCard
            label="Saldo total de clientes"
            value={formatMXN(stats.totalClientBalance)}
            icon={Wallet}
          />
          <StatCard
            label="Mi comisión acumulada"
            value={formatMXN(stats.commissionAccrued)}
            sub={`Pagada: ${formatMXN(stats.commissionPaid)}`}
            icon={Percent}
            accent="success"
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aún no tienes clientes asignados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Saldo disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.userId}>
                      <TableCell>
                        <div className="font-medium">{c.name ?? c.email}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? "success" : "outline"}>
                          {c.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatMXN(c.availableBalance)}
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
