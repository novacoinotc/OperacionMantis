import { config } from "dotenv";
config({ path: ".env.local" });

import { hashPassword } from "../lib/auth/password";
import { encryptSecret } from "../lib/crypto";

/**
 * Seed idempotente. Crea: admin (con tu correo), un broker demo y un cliente
 * demo con su cuenta NovaCore (credenciales mock). Re-ejecutar no duplica.
 *   pnpm db:seed
 */
async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { users, clientAccounts } = await import("./schema");

  async function upsertUser(input: {
    email: string;
    name: string;
    role: "admin" | "broker" | "user";
    password: string;
    brokerId?: string | null;
  }): Promise<string> {
    const email = input.email.toLowerCase();
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing.id;
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: input.name,
        role: input.role,
        passwordHash: hashPassword(input.password),
        brokerId: input.brokerId ?? null,
      })
      .returning({ id: users.id });
    return created.id;
  }

  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Mantis#2026";
  const brokerPass = process.env.SEED_BROKER_PASSWORD || "Broker#2026";
  const clientPass = process.env.SEED_CLIENT_PASSWORD || "Cliente#2026";

  const adminId = await upsertUser({
    email: "direccion@novacoin.mx",
    name: "Dirección",
    role: "admin",
    password: adminPass,
  });

  const brokerId = await upsertUser({
    email: "broker@demo.mx",
    name: "Broker Demo",
    role: "broker",
    password: brokerPass,
  });

  const clientUserId = await upsertUser({
    email: "cliente@demo.mx",
    name: "Cliente Demo",
    role: "user",
    password: clientPass,
    brokerId,
  });

  // Cuenta NovaCore del cliente (credenciales mock para desarrollo).
  const [existingAccount] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.userId, clientUserId))
    .limit(1);

  if (!existingAccount) {
    await db.insert(clientAccounts).values({
      userId: clientUserId,
      label: "Cuenta Demo",
      novacoreApiKeyPrefix: "MOCK1234",
      novacoreClabe: "684180327002001314",
      encApiKey: encryptSecret("mock-api-key-plaintext"),
      encWebhookSecret: encryptSecret("mock-webhook-secret"),
      encDepositSecret: encryptSecret("mock-deposit-secret"),
      payerName: "OUHAMI SERVICES SA DE CV",
      availableBalance: 0,
    });
  }

  console.log("✓ Seed completo");
  console.log("  admin   → direccion@novacoin.mx /", adminPass);
  console.log("  broker  → broker@demo.mx /", brokerPass);
  console.log("  cliente → cliente@demo.mx /", clientPass);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed falló:", err);
    process.exit(1);
  });
