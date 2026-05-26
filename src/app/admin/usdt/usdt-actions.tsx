"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { completeUsdtAction, rejectUsdtAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UsdtOrderActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [hash, setHash] = useState("");

  function complete() {
    start(async () => {
      const res = await completeUsdtAction(id, hash);
      if (res.ok) toast.success("Orden marcada como pagada.");
      else toast.error(res.error ?? "No se pudo completar.");
    });
  }

  function reject() {
    start(async () => {
      const res = await rejectUsdtAction(id);
      if (res.ok) toast.success("Orden rechazada y saldo reembolsado.");
      else toast.error(res.error ?? "No se pudo rechazar.");
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        value={hash}
        onChange={(e) => setHash(e.target.value)}
        placeholder="tx hash"
        className="h-8 w-32"
      />
      <Button size="sm" variant="ghost" onClick={reject} disabled={pending}>
        <X className="size-4" />
      </Button>
      <Button size="sm" onClick={complete} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Pagada
      </Button>
    </div>
  );
}
