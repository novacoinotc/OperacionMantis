"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { approveWithdrawalAction, rejectWithdrawalAction } from "./actions";
import { Button } from "@/components/ui/button";

export function WithdrawalActions({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function approve() {
    start(async () => {
      const res = await approveWithdrawalAction(id);
      if (res.ok) toast.success("Retiro aprobado y enviado a NovaCore.");
      else toast.error(res.error ?? "No se pudo aprobar.");
    });
  }

  function reject() {
    start(async () => {
      const res = await rejectWithdrawalAction(id);
      if (res.ok) toast.success("Retiro rechazado y saldo reembolsado.");
      else toast.error(res.error ?? "No se pudo rechazar.");
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={reject} disabled={pending}>
        <X className="size-4" /> Rechazar
      </Button>
      <Button size="sm" onClick={approve} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Aprobar
      </Button>
    </div>
  );
}
