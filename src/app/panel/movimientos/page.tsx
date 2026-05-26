import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId, getClientMovements } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { MovementsTable } from "@/components/movements-table";

export const metadata = { title: "Movimientos" };

export default async function MovimientosPage() {
  const user = await requireRole("user");
  const account = await getClientAccountByUserId(user.id);
  const movements = account ? await getClientMovements(account.id, 100) : [];

  return (
    <Reveal>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos los movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementsTable movements={movements} />
        </CardContent>
      </Card>
    </Reveal>
  );
}
