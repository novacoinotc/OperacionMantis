import { config } from "dotenv";
config({ path: ".env.local" });
import crypto from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

/** Crea logins adicionales que COMPARTEN la cuenta de MACAIBA (ncapi-a3). */
const EMAILS = ["benjamin.alonso@consultingmas.com", "m@latamcm.net"];

function randPass() {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index");
  const { users, clientAccounts } = await import("../src/db/schema");

  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.novacoreApiKeyPrefix, "ncapi-a3"))
    .limit(1);
  if (!acc) throw new Error("No existe la cuenta MACAIBA (ncapi-a3).");

  for (const raw of EMAILS) {
    const email = raw.toLowerCase();
    const pass = randPass();
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db
        .update(users)
        .set({ role: "user", clientAccountId: acc.id, passwordHash: hashPassword(pass), brokerId: null })
        .where(eq(users.id, existing.id));
      console.log("• actualizado:", email, "/", pass);
    } else {
      await db.insert(users).values({
        email,
        name: "MACAIBA COMMERCE",
        role: "user",
        clientAccountId: acc.id,
        passwordHash: hashPassword(pass),
      });
      console.log("✓ creado:", email, "/", pass);
    }
  }
  console.log("\nComparten la cuenta MACAIBA → ven las 3 CLABEs y el mismo saldo que ops.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Falló:", e);
    process.exit(1);
  });
