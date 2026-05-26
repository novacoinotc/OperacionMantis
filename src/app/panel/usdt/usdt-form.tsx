"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createUsdtAction, type UsdtState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMXN } from "@/lib/money";

export function UsdtForm({
  availableBalance,
  effectiveRate,
}: {
  availableBalance: number;
  effectiveRate: number;
}) {
  const [state, action, pending] = useActionState<UsdtState, FormData>(createUsdtAction, null);
  const [amount, setAmount] = useState("");

  const amt = Number(amount);
  const usdt = effectiveRate > 0 && amt > 0 ? amt / effectiveRate : 0;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Monto a convertir (MXN)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="1"
          max={(availableBalance / 100).toFixed(2)}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Disponible: <span className="tabular">{formatMXN(availableBalance)}</span>
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">Recibirás aproximadamente</p>
        <p className="tabular mt-1 text-2xl font-semibold text-success">
          {usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tipo de cambio: <span className="tabular">{effectiveRate.toFixed(4)}</span> MXN/USDT
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-2">
          <Label htmlFor="usdtAddress">Dirección USDT</Label>
          <Input id="usdtAddress" name="usdtAddress" placeholder="Tu wallet" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usdtNetwork">Red</Label>
          <select
            id="usdtNetwork"
            name="usdtNetwork"
            defaultValue="TRC20"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="TRC20">TRC20</option>
            <option value="ERC20">ERC20</option>
            <option value="BEP20">BEP20</option>
            <option value="SOL">Solana</option>
          </select>
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
        {pending ? "Creando…" : "Solicitar conversión"}
      </Button>
    </form>
  );
}
