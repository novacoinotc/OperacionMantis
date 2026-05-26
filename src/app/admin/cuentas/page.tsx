import { requireRole } from "@/lib/auth";
import { getAdminAccounts } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
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

export const metadata = { title: "Cuentas" };

export default async function AdminCuentasPage() {
  await requireRole("admin");
  const accounts = await getAdminAccounts();

  return (
    <Reveal>
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
                      <div className="text-xs text-muted-foreground">{a.clientEmail}</div>
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
  );
}
