import { hmacSha256, safeEqual } from "@/lib/crypto";

/**
 * Verificación de firmas de los webhooks de NovaCore. Los dos webhooks usan
 * formatos DISTINTOS — ojo:
 *
 *  Webhook A (depósito):  header = `sha256=<hmac(secret, `${ts}.${nonce}.${rawBody}`)>`
 *  Webhook C (retiro):    header = `<hmac(secret, rawBody)>`  (plano, sin prefijo)
 */

const DEFAULT_TOLERANCE_SEC = 300;

export function verifyDepositSignature(opts: {
  secret: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
  signatureHeader: string;
  toleranceSec?: number;
}): { ok: boolean; reason?: string } {
  const tolerance = opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "timestamp inválido" };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    return { ok: false, reason: "timestamp fuera de la ventana de ±5 min" };
  }

  const expected = `sha256=${hmacSha256(opts.secret, `${opts.timestamp}.${opts.nonce}.${opts.rawBody}`)}`;
  if (!safeEqual(expected, opts.signatureHeader)) {
    return { ok: false, reason: "firma no coincide" };
  }
  return { ok: true };
}

export function verifyWithdrawalSignature(opts: {
  secret: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const expected = hmacSha256(opts.secret, opts.rawBody);
  return safeEqual(expected, opts.signatureHeader);
}
