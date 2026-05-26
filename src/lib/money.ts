/**
 * Utilidades de dinero. Regla de oro: TODO el dinero se maneja en enteros.
 *  - MXN  → centavos  (1 MXN = 100 centavos)
 *  - USDT → micro-USDT (1 USDT = 1_000_000 micro)
 * Nunca usamos floats para aritmética monetaria; usamos BigInt y redondeamos
 * explícitamente al convertir.
 */

export const BPS_DENOM = 10_000; // 100.00% = 10000 bps
export const USDT_SCALE = 1_000_000; // micro-USDT por USDT

/** Aplica puntos base a un monto en centavos (trunca hacia abajo). */
export function applyBps(amountCentavos: number, bps: number): number {
  return Number((BigInt(Math.round(amountCentavos)) * BigInt(bps)) / BigInt(BPS_DENOM));
}

/** Parte un depósito bruto en comisión (4%) y neto. */
export function splitDeposit(
  grossCentavos: number,
  commissionBps: number,
): { commission: number; net: number } {
  const commission = applyBps(grossCentavos, commissionBps);
  return { commission, net: grossCentavos - commission };
}

/**
 * Bruto-equivalente de un retiro neto: el monto bruto que originó ese neto.
 *   grossEquiv = net / (1 - commissionBps/10000)
 * Base sobre la que se calcula la comisión del broker.
 */
export function grossEquivalent(netCentavos: number, commissionBps: number): number {
  const numerator = BigInt(Math.round(netCentavos)) * BigInt(BPS_DENOM);
  const denom = BigInt(BPS_DENOM - commissionBps);
  // redondeo al centavo más cercano
  return Number((numerator + denom / BigInt(2)) / denom);
}

/** Comisión del broker sobre el bruto-equivalente. */
export function brokerCommission(
  netCentavos: number,
  commissionBps: number,
  brokerBps: number,
): { grossEquiv: number; commission: number } {
  const grossEquiv = grossEquivalent(netCentavos, commissionBps);
  return { grossEquiv, commission: applyBps(grossEquiv, brokerBps) };
}

/** Parsea un string/numero de pesos (ej. "1000000.00" o 50000) a centavos. */
export function pesosToCentavos(pesos: string | number): number {
  const n = typeof pesos === "string" ? Number(pesos) : pesos;
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${pesos}`);
  return Math.round(n * 100);
}

export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea centavos como "$1,000,000.00". */
export function formatMXN(centavos: number): string {
  return mxnFormatter.format(centavos / 100);
}

const usdtFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** Formatea micro-USDT como "1,234.56 USDT". */
export function formatUSDT(microUsdt: number): string {
  return `${usdtFormatter.format(microUsdt / USDT_SCALE)} USDT`;
}

/**
 * Convierte MXN (centavos) a micro-USDT a una tasa efectiva (MXN por USDT).
 *   micro = netCentavos * 1e6 / (rate * 100)
 */
export function usdtFromMxn(netCentavos: number, effectiveRateMxnPerUsdt: number): number {
  const centavosPerUsdt = BigInt(Math.round(effectiveRateMxnPerUsdt * 100));
  if (centavosPerUsdt <= BigInt(0)) throw new Error("Tasa inválida");
  const micro = (BigInt(Math.round(netCentavos)) * BigInt(USDT_SCALE)) / centavosPerUsdt;
  return Number(micro);
}

/** Tasa efectiva = tasa de Bitso + markup en centavos (ej. +0.05 MXN). */
export function effectiveRate(bitsoRateMxnPerUsdt: number, markupCentavos: number): number {
  return bitsoRateMxnPerUsdt + markupCentavos / 100;
}
