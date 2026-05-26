/** Helpers de presentación: etiquetas y variantes de estado, formato de fecha. */

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  processing: "En proceso",
  sent: "Enviado",
  settled: "Liquidado",
  returned: "Devuelto",
  canceled: "Cancelado",
  failed: "Fallido",
  completed: "Completado",
  paid: "Pagado",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warning",
  approved: "secondary",
  rejected: "destructive",
  processing: "secondary",
  sent: "secondary",
  settled: "success",
  returned: "destructive",
  canceled: "outline",
  failed: "destructive",
  completed: "success",
  paid: "success",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT[status] ?? "secondary";
}

const dtf = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City", // hora de Guadalajara (UTC-6), no la del servidor
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dtf.format(typeof d === "string" ? new Date(d) : d);
}
