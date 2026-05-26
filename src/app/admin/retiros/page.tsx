import { requireRole } from "@/lib/auth";
import { getAdminWithdrawals } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { formatDateTime, statusLabel, statusVariant } from "@/lib/ui";
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
import { WithdrawalActions } from "./withdrawal-actions";

export const metadata = { title: "Retiros SPEI" };

export default async function AdminRetirosPage() {
  await requireRole("admin");
  const rows = await getAdminWithdrawals("spei");

  return (
    <Reveal>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retiros SPEI</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin retiros todavía.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / Beneficiario</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.clientName ?? r.clientEmail}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.beneficiaryName} · {r.beneficiaryAccount}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatMXN(r.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <WithdrawalActions id={r.id} />
                      ) : (
                        <span className="tabular text-xs text-muted-foreground">
                          {r.novacoreTrackingKey ?? "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}
