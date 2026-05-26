import { requireRole } from "@/lib/auth";
import { getAdminDeposits, getAdminOverview } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { formatDateTime } from "@/lib/ui";
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
import { Banknote, Percent, Wallet } from "lucide-react";

export const metadata = { title: "Depósitos" };

export default async function AdminDepositosPage() {
  await requireRole("admin");
  const [ov, rows] = await Promise.all([getAdminOverview(), getAdminDeposits(100)]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Bruto recibido" value={formatMXN(ov.deposits.gross)} sub={`${ov.deposits.count} depósito(s)`} icon={Banknote} accent="primary" />
          <StatCard label="Comisión 4% (oculta al cliente)" value={formatMXN(ov.deposits.commission)} icon={Percent} accent="success" />
          <StatCard label="Neto acreditado a clientes" value={formatMXN(ov.deposits.net)} icon={Wallet} />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Depósitos · desglose bruto → comisión → neto</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin depósitos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pagador / Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.payerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.clientName ?? r.clientEmail} · CLABE …{r.beneficiaryAccount?.slice(-4)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(r.receivedAt)}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMXN(r.grossAmount)}</TableCell>
                      <TableCell className="tabular text-right text-success">
                        −{formatMXN(r.commissionAmount)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({(r.commissionBps / 100).toFixed(0)}%)
                        </span>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatMXN(r.netAmount)}
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
