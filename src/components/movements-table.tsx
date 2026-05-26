import { ArrowDownLeft, ArrowUpRight, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMXN } from "@/lib/money";
import { formatDateTime, statusLabel, statusVariant } from "@/lib/ui";
import type { Movement } from "@/lib/queries";
import { cn } from "@/lib/utils";

const KIND_META = {
  deposit: { label: "Ingreso", Icon: ArrowDownLeft },
  spei: { label: "Retiro SPEI", Icon: ArrowUpRight },
  usdt: { label: "Conversión USDT", Icon: Coins },
} as const;

export function MovementsTable({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Concepto</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => {
          const { Icon, label } = KIND_META[m.kind];
          const positive = m.amount >= 0;
          return (
            <TableRow key={`${m.kind}-${m.id}`}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      positive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate">{m.detail || label}</div>
                    {m.clabe ? (
                      <div className="tabular text-xs text-muted-foreground">
                        CLABE …{m.clabe.slice(-4)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(m.date)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
              </TableCell>
              <TableCell
                className={cn(
                  "tabular text-right font-medium",
                  positive ? "text-success" : "text-foreground",
                )}
              >
                {positive ? "+" : "−"}
                {formatMXN(Math.abs(m.amount))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
