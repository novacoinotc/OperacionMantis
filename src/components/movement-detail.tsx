"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { formatMXN, formatUSDT } from "@/lib/money";
import { formatDateTime, statusLabel, statusVariant } from "@/lib/ui";
import type { Movement } from "@/lib/queries";

const KIND_LABEL: Record<Movement["kind"], string> = {
  deposit: "Depósito SPEI",
  spei: "Retiro SPEI",
  usdt: "Conversión a USDT",
};

function DetailRow({
  label,
  value,
  copy,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  copy?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-right text-sm">
        <span className={mono ? "tabular break-all" : "break-words"}>{value}</span>
        {copy ? <CopyButton value={value} /> : null}
      </span>
    </div>
  );
}

export function MovementDetailButton({ m }: { m: Movement }) {
  const [open, setOpen] = useState(false);
  const positive = m.amount >= 0;

  const summary = [
    `${KIND_LABEL[m.kind]}`,
    `Monto: ${formatMXN(Math.abs(m.amount))}`,
    `Estado: ${statusLabel(m.status)}`,
    `Fecha: ${formatDateTime(m.date)}`,
    m.counterparty ? `Contraparte: ${m.counterparty}` : null,
    m.counterpartyAccount ? `Cuenta: ${m.counterpartyAccount}` : null,
    m.trackingKey ? `Clave de rastreo: ${m.trackingKey}` : null,
    m.reference ? `Referencia: ${m.reference}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Detalle
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader className="px-0">
            <SheetTitle className="flex items-center gap-2">
              {KIND_LABEL[m.kind]}
              <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Monto</p>
            <p
              className={`tabular text-3xl font-semibold ${positive ? "text-success" : "text-foreground"}`}
            >
              {positive ? "+" : "−"}
              {formatMXN(Math.abs(m.amount))}
            </p>
          </div>

          <div className="mt-4">
            <DetailRow label="Fecha" value={formatDateTime(m.date)} />
            <DetailRow
              label="Liquidado en (banco)"
              value={m.settledAt ? formatDateTime(m.settledAt) : null}
            />
            <DetailRow label="Concepto" value={m.concept} />
            <DetailRow
              label={m.kind === "deposit" ? "Pagador" : "Beneficiario"}
              value={m.counterparty}
            />
            <DetailRow label="Cuenta" value={m.counterpartyAccount} copy mono />
            <DetailRow label="CLABE de entrada" value={m.clabe} copy mono />
            <DetailRow label="Clave de rastreo" value={m.trackingKey} copy mono />
            <DetailRow label="Referencia" value={m.reference} copy mono />
            {m.kind === "usdt" ? (
              <>
                <DetailRow
                  label="USDT"
                  value={m.usdtAmount != null ? formatUSDT(m.usdtAmount) : null}
                  mono
                />
                <DetailRow label="Tipo de cambio" value={m.usdtRate} mono />
                <DetailRow label="Dirección USDT" value={m.usdtAddress} copy mono />
                <DetailRow label="Tx hash" value={m.usdtTxHash} copy mono />
              </>
            ) : null}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(summary);
                  toast.success("Datos copiados");
                } catch {
                  toast.error("No se pudo copiar");
                }
              }}
            >
              <ClipboardCopy className="size-4" /> Copiar datos
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
