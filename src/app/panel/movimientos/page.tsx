import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId, getClientMovements } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { MovementsTable } from "@/components/movements-table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Movimientos" };

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ clabe?: string }>;
}) {
  const user = await requireRole("user");
  const account = await getClientAccountByUserId(user.id);
  const { clabe } = await searchParams;

  const clabes = account?.depositClabes ?? [];
  const activeClabe = clabe && clabes.includes(clabe) ? clabe : undefined;
  const movements = account
    ? await getClientMovements(account.id, { limit: 100, clabe: activeClabe })
    : [];

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-xs transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:text-foreground",
    );

  return (
    <Reveal>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clabes.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/movimientos" className={chipClass(!activeClabe)}>
                Todas
              </Link>
              {clabes.map((c) => (
                <Link
                  key={c}
                  href={`/panel/movimientos?clabe=${c}`}
                  className={cn("tabular", chipClass(activeClabe === c))}
                >
                  CLABE …{c.slice(-4)}
                </Link>
              ))}
            </div>
          ) : null}
          <MovementsTable movements={movements} />
        </CardContent>
      </Card>
    </Reveal>
  );
}
