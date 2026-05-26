"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createBrokerAction, createClientAction, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Broker = { id: string; name: string | null; email: string };

function Feedback({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
    );
  if (state?.success)
    return (
      <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> {state.success}
      </p>
    );
  return null;
}

function BrokerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBrokerAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="b-name">Nombre</Label>
          <Input id="b-name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-email">Correo</Label>
          <Input id="b-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-password">Contraseña</Label>
          <Input id="b-password" name="password" type="text" required />
        </div>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Crear broker
      </Button>
    </form>
  );
}

function ClientForm({ brokers }: { brokers: Broker[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createClientAction, null);
  const selectClass =
    "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Datos del cliente</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-name">Nombre</Label>
            <Input id="c-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-broker">Broker asignado</Label>
            <select id="c-broker" name="brokerId" defaultValue="" className={selectClass}>
              <option value="">Sin broker</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">Correo</Label>
            <Input id="c-email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-password">Contraseña</Label>
            <Input id="c-password" name="password" type="text" required />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Credenciales NovaCore</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-clabe">CLABE asignada (18 dígitos)</Label>
            <Input id="c-clabe" name="clabe" inputMode="numeric" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-payerName">Payer name (CEP)</Label>
            <Input id="c-payerName" name="payerName" placeholder="RAZÓN SOCIAL S.A. DE C.V." />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-apiKey">API key (texto plano)</Label>
            <Input id="c-apiKey" name="apiKey" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-depositSecret">deposit_callback_secret</Label>
            <Input id="c-depositSecret" name="depositSecret" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-webhookSecret">webhook_secret</Label>
            <Input id="c-webhookSecret" name="webhookSecret" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-payerRfc">Payer RFC (opcional)</Label>
            <Input id="c-payerRfc" name="payerRfc" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-maxAmount">Máx. por operación (MXN)</Label>
            <Input id="c-maxAmount" name="maxAmount" type="number" defaultValue="50000" required />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Comisiones (puntos base · 400 = 4%)</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="c-commissionBps">Comisión cliente</Label>
            <Input id="c-commissionBps" name="commissionBps" type="number" defaultValue="400" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-brokerSpeiBps">Broker SPEI</Label>
            <Input id="c-brokerSpeiBps" name="brokerSpeiBps" type="number" defaultValue="150" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-brokerCryptoBps">Broker crypto</Label>
            <Input id="c-brokerCryptoBps" name="brokerCryptoBps" type="number" defaultValue="120" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-usdtMarkup">Markup USDT (¢)</Label>
            <Input id="c-usdtMarkup" name="usdtMarkupCentavos" type="number" defaultValue="5" required />
          </div>
        </div>
      </section>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Crear cliente
      </Button>
    </form>
  );
}

export function UserForms({ brokers }: { brokers: Broker[] }) {
  return (
    <Tabs defaultValue="client">
      <TabsList>
        <TabsTrigger value="client">Nuevo cliente</TabsTrigger>
        <TabsTrigger value="broker">Nuevo broker</TabsTrigger>
      </TabsList>
      <TabsContent value="client" className="pt-4">
        <ClientForm brokers={brokers} />
      </TabsContent>
      <TabsContent value="broker" className="pt-4">
        <BrokerForm />
      </TabsContent>
    </Tabs>
  );
}
