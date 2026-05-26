import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getBrokerClients } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
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

export const metadata = { title: "Clientes" };

export default async function BrokerClientesPage() {
  const user = await requireRole("broker");
  const clients = await getBrokerClients(user.id);

  return (
    <Reveal>
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
                      <Link
                        href={`/broker/cliente/${c.userId}`}
                        className="font-medium hover:underline"
                      >
                        {c.name ?? c.email}
                      </Link>
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
  );
}
