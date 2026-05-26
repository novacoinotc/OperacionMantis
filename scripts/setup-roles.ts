import { config } from "dotenv";
config({ path: ".env.local" });
import crypto from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

/** Crea el broker y reasigna la cuenta MACAIBA al cliente final ops@opmantis.com. */

function randPass(): string {
  return crypto.randomBytes(9).toString("base64url");
}

const BROKER_EMAIL = "ilopez@axiesinternational.mx";
const CLIENT_EMAIL = "ops@opmantis.com";

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index");
  const { users, clientAccounts } = await import("../src/db/schema");

  // 1) Broker
  const brokerPass = randPass();
  let [broker] = await db.select().from(users).where(eq(users.email, BROKER_EMAIL)).limit(1);
  if (!broker) {
    [broker] = await db
      .insert(users)
      .values({
        email: BROKER_EMAIL,
        name: "I. López — Axies International",
        role: "broker",
        passwordHash: hashPassword(brokerPass),
      })
      .returning();
  } else {
    await db
      .update(users)
      .set({ role: "broker", passwordHash: hashPassword(brokerPass) })
      .where(eq(users.id, broker.id));
  }

  // 2) Cliente final = cuenta MACAIBA (ncapi-a3), reasignada a ops@opmantis.com + broker
  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.novacoreApiKeyPrefix, "ncapi-a3"))
    .limit(1);
  if (!acc) throw new Error("No existe la cuenta ncapi-a3. Corre configure-macaiba primero.");

  const clientPass = randPass();
  await db
    .update(users)
    .set({ email: CLIENT_EMAIL, brokerId: broker.id, passwordHash: hashPassword(clientPass) })
    .where(eq(users.id, acc.userId));

  await db.update(clientAccounts).set({ availableBalance: 0 }).where(eq(clientAccounts.id, acc.id));

  console.log("\n=== ROLES LISTOS ===");
  console.log("Broker  →", BROKER_EMAIL, "/", brokerPass);
  console.log("Cliente →", CLIENT_EMAIL, "/", clientPass, " (broker:", BROKER_EMAIL + ")");
  console.log("CLABEs de depósito (visibles al cliente):", acc.depositClabes?.join(", "));
  console.log("CLABE de salida (OCULTA al cliente):", acc.novacoreClabe);
  console.log("Saldo: 0 · sin depósitos\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Setup falló:", e);
    process.exit(1);
  });
