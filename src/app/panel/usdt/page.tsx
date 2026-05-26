import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId } from "@/lib/queries";
import { getUsdtQuote } from "@/lib/services/usdt";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { UsdtForm } from "./usdt-form";

export const metadata = { title: "Comprar USDT" };

export default async function UsdtPage() {
  const user = await requireRole("user");
  const account = await getClientAccountByUserId(user.id);

  let rate: number | null = null;
  try {
    if (account) {
      const quote = await getUsdtQuote(account.usdtMarkupCentavos);
      rate = quote.effectiveRate;
    }
  } catch {
    rate = null;
  }

  return (
    <div className="mx-auto max-w-xl">
      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>Comprar USDT</CardTitle>
            <CardDescription>
              Tipo de cambio de Bitso en tiempo real. El retiro se procesa manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!account ? (
              <p className="text-sm text-muted-foreground">
                Tu cuenta aún no está configurada. Contacta a tu broker.
              </p>
            ) : rate === null ? (
              <p className="text-sm text-muted-foreground">
                El tipo de cambio no está disponible en este momento. Intenta más tarde.
              </p>
            ) : (
              <UsdtForm availableBalance={account.availableBalance} effectiveRate={rate} />
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
