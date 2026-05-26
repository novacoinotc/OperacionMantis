import { requireRole } from "@/lib/auth";
import { getAllUsers, getBrokersList } from "@/lib/queries";
import { formatDateTime } from "@/lib/ui";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserForms } from "./user-forms";

export const metadata = { title: "Usuarios" };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", broker: "Broker", user: "Cliente" };
const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  broker: "secondary",
  user: "outline",
};

export default async function AdminUsuariosPage() {
  await requireRole("admin");
  const [allUsers, brokers] = await Promise.all([getAllUsers(), getBrokersList()]);

  return (
    <div className="space-y-8">
      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <UserForms brokers={brokers} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuarios ({allUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead className="text-right">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name ?? u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.brokerName ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
