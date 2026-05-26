import { desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { brokerPayouts, users } from "@/db/schema";
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
import { PayoutActions } from "./payout-actions";

export const metadata = { title: "Comisiones" };

export default async function AdminComisionesPage() {
  await requireRole("admin");
  const rows = await db
    .select({
      id: brokerPayouts.id,
      method: brokerPayouts.method,
      amount: brokerPayouts.amount,
      status: brokerPayouts.status,
      destinationClabe: brokerPayouts.destinationClabe,
      destinationName: brokerPayouts.destinationName,
      destinationAddress: brokerPayouts.destinationAddress,
      destinationNetwork: brokerPayouts.destinationNetwork,
      createdAt: brokerPayouts.createdAt,
      brokerName: users.name,
      brokerEmail: users.email,
    })
    .from(brokerPayouts)
    .innerJoin(users, eq(users.id, brokerPayouts.brokerUserId))
    .orderBy(
      sql`case when ${brokerPayouts.status} = 'pending' then 0 else 1 end`,
      desc(brokerPayouts.createdAt),
    )
    .limit(100);

  return (
    <Reveal>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobros de comisiones (brokers)</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sin solicitudes de cobro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broker / Destino</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.brokerName ?? r.brokerEmail}</div>
                      <div className="tabular text-xs text-muted-foreground">
                        {r.method === "spei"
                          ? `${r.destinationName ?? ""} · ${r.destinationClabe ?? ""}`
                          : `${r.destinationAddress ?? ""} (${r.destinationNetwork ?? ""})`}
                      </div>
                    </TableCell>
                    <TableCell className="uppercase">{r.method}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatMXN(r.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <PayoutActions id={r.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(r.createdAt)}
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
