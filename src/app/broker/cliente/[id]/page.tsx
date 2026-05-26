import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getBrokerClientDetail, getClientMovements } from "@/lib/queries";
import { formatMXN } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { MovementsTable } from "@/components/movements-table";

export const metadata = { title: "Cliente" };

export default async function BrokerClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const broker = await requireRole("broker");
  const { id } = await params;
  const client = await getBrokerClientDetail(broker.id, id);
  if (!client) notFound();

  const movements = await getClientMovements(client.accountId, { limit: 100 });

  return (
    <div className="space-y-6">
      <Link
        href="/broker/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mis clientes
      </Link>

      <Reveal>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" /> {client.name ?? client.email}
            </div>
            <p className="tabular mt-1 text-3xl font-semibold">
              {formatMXN(client.availableBalance)}
            </p>
            <p className="text-xs text-muted-foreground">Saldo disponible del cliente</p>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial completo</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementsTable movements={movements} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
