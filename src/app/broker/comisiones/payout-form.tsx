"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { requestPayoutAction, type PayoutState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMXN } from "@/lib/money";

export function PayoutForm({ accrued, hasPending }: { accrued: number; hasPending: boolean }) {
  const [state, action, pending] = useActionState<PayoutState, FormData>(
    requestPayoutAction,
    null,
  );
  const [method, setMethod] = useState<"spei" | "crypto">("spei");

  if (hasPending) {
    return (
      <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
        Tienes una solicitud de cobro pendiente. Espera a que el admin la procese.
      </p>
    );
  }

  if (accrued <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes comisiones por cobrar todavía. Se acumulan al aprobarse retiros de tus clientes.
      </p>
    );
  }

  const selectClass =
    "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vas a cobrar <span className="tabular font-semibold text-foreground">{formatMXN(accrued)}</span>.
      </p>

      <div className="space-y-2">
        <Label htmlFor="method">Método</Label>
        <select
          id="method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as "spei" | "crypto")}
          className={selectClass}
        >
          <option value="spei">SPEI</option>
          <option value="crypto">Crypto (USDT)</option>
        </select>
      </div>

      {method === "spei" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="destinationClabe">CLABE destino</Label>
            <Input id="destinationClabe" name="destinationClabe" inputMode="numeric" placeholder="18 dígitos" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinationName">Beneficiario</Label>
            <Input id="destinationName" name="destinationName" placeholder="Nombre" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label htmlFor="destinationAddress">Dirección USDT</Label>
            <Input id="destinationAddress" name="destinationAddress" placeholder="Wallet" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinationNetwork">Red</Label>
            <select id="destinationNetwork" name="destinationNetwork" defaultValue="TRC20" className={selectClass}>
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20</option>
              <option value="BEP20">BEP20</option>
            </select>
          </div>
        </div>
      )}

      {state?.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Cobrar comisiones
      </Button>
    </form>
  );
}
