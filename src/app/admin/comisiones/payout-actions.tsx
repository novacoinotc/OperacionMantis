"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { payPayoutAction, rejectPayoutAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PayoutActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [ref, setRef] = useState("");

  function pay() {
    start(async () => {
      const res = await payPayoutAction(id, ref);
      if (res.ok) toast.success("Cobro marcado como pagado.");
      else toast.error(res.error ?? "No se pudo pagar.");
    });
  }

  function reject() {
    start(async () => {
      const res = await rejectPayoutAction(id);
      if (res.ok) toast.success("Cobro rechazado.");
      else toast.error(res.error ?? "No se pudo rechazar.");
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="ref / tx"
        className="h-8 w-32"
      />
      <Button size="sm" variant="ghost" onClick={reject} disabled={pending}>
        <X className="size-4" />
      </Button>
      <Button size="sm" onClick={pay} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Pagar
      </Button>
    </div>
  );
}
