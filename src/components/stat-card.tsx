import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "primary" | "success" | "warning" | "muted";
}) {
  const accentClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[accent ?? "muted"];

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="tabular mt-1 truncate text-2xl font-semibold">{value}</p>
          {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        {Icon ? <Icon className={cn("size-5 shrink-0", accentClass)} /> : null}
      </CardContent>
    </Card>
  );
}
