import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { RetiroForm } from "./retiro-form";

export const metadata = { title: "Retirar por SPEI" };

export default async function RetiroPage() {
  const user = await requireRole("user");
  const account = await getClientAccountByUserId(user.id);

  return (
    <div className="mx-auto max-w-xl">
      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>Retirar por SPEI</CardTitle>
            <CardDescription>
              El monto se descuenta de tu saldo disponible y queda pendiente de aprobación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {account ? (
              <RetiroForm availableBalance={account.availableBalance} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Tu cuenta aún no está configurada. Contacta a tu broker.
              </p>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
