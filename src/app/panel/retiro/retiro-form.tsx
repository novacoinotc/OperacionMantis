"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { requestSpeiAction, type RetiroState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMXN } from "@/lib/money";

export function RetiroForm({ availableBalance }: { availableBalance: number }) {
  const [state, action, pending] = useActionState<RetiroState, FormData>(requestSpeiAction, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Monto a retirar (MXN)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="1"
          max={(availableBalance / 100).toFixed(2)}
          placeholder="0.00"
          required
        />
        <p className="text-xs text-muted-foreground">
          Disponible: <span className="tabular">{formatMXN(availableBalance)}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="beneficiaryAccount">CLABE o tarjeta destino</Label>
        <Input
          id="beneficiaryAccount"
          name="beneficiaryAccount"
          inputMode="numeric"
          placeholder="18 dígitos (CLABE) o 16 (tarjeta)"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="beneficiaryName">Nombre del beneficiario</Label>
        <Input id="beneficiaryName" name="beneficiaryName" placeholder="Nombre completo" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="beneficiaryRfc">RFC (opcional)</Label>
          <Input id="beneficiaryRfc" name="beneficiaryRfc" placeholder="—" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="concept">Concepto (opcional)</Label>
          <Input id="concept" name="concept" placeholder="RETIRO" />
        </div>
      </div>

      {state?.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Enviando…" : "Solicitar retiro"}
      </Button>
    </form>
  );
}
