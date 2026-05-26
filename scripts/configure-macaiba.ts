import { config } from "dotenv";
config({ path: ".env.local" });

import { hashPassword } from "../src/lib/auth/password";
import { encryptSecret } from "../src/lib/crypto";

/**
 * Configura (crea o actualiza) la cuenta del cliente MACAIBA COMMERCE con sus
 * credenciales reales de NovaCore. Los SECRETS se leen de variables de entorno
 * (no se hardcodean en el repo):
 *   MACAIBA_API_KEY, MACAIBA_DEPOSIT_SECRET, MACAIBA_WEBHOOK_SECRET
 * Datos no sensibles (CLABEs, prefix, payer) van aquí.
 */
const CFG = {
  email: (process.env.MACAIBA_EMAIL || "macaiba@opmantis.com").toLowerCase(),
  name: "MACAIBA COMMERCE",
  password: process.env.MACAIBA_PASSWORD || "Macaiba#2026",
  apiKeyPrefix: "ncapi-a3",
  clabeOut: "684180327010000103",
  depositClabes: ["684180327010000022", "684180327010000080", "684180327010000093"],
  payerName: "MACAIBA COMMERCE",
  maxAmountCentavos: 850_000_00,
};

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v;
}

async function main() {
  const apiKey = reqEnv("MACAIBA_API_KEY");
  const depositSecret = reqEnv("MACAIBA_DEPOSIT_SECRET");
  const webhookSecret = reqEnv("MACAIBA_WEBHOOK_SECRET");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index");
  const { users, clientAccounts } = await import("../src/db/schema");

  let [user] = await db.select().from(users).where(eq(users.email, CFG.email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: CFG.email,
        name: CFG.name,
        role: "user",
        passwordHash: hashPassword(CFG.password),
      })
      .returning();
    console.log("✓ Usuario MACAIBA creado");
  } else {
    console.log("• Usuario MACAIBA ya existía");
  }

  const creds = {
    novacoreApiKeyPrefix: CFG.apiKeyPrefix,
    novacoreClabe: CFG.clabeOut,
    depositClabes: CFG.depositClabes,
    encApiKey: encryptSecret(apiKey),
    encDepositSecret: encryptSecret(depositSecret),
    encWebhookSecret: encryptSecret(webhookSecret),
    payerName: CFG.payerName,
    maxAmountPerOperation: CFG.maxAmountCentavos,
    updatedAt: new Date(),
  };

  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.userId, user.id))
    .limit(1);

  if (acc) {
    await db.update(clientAccounts).set(creds).where(eq(clientAccounts.id, acc.id));
    console.log("✓ Cuenta NovaCore actualizada");
  } else {
    await db.insert(clientAccounts).values({ userId: user.id, label: CFG.name, ...creds });
    console.log("✓ Cuenta NovaCore creada");
  }

  console.log("Login MACAIBA →", CFG.email, "/", CFG.password);
  console.log("prefix:", CFG.apiKeyPrefix, "| depósito:", CFG.depositClabes.join(", "), "| salida:", CFG.clabeOut);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Config falló:", e);
    process.exit(1);
  });
