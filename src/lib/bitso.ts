import { z } from "zod";

/** Lector del ticker público de Bitso (sin API key). Book por defecto: usdt_mxn. */

const tickerSchema = z.object({
  success: z.boolean(),
  payload: z.object({
    book: z.string(),
    bid: z.string(),
    ask: z.string(),
    last: z.string(),
  }),
});

export type BitsoTicker = { book: string; bid: number; ask: number; last: number };

export async function fetchBitsoTicker(): Promise<BitsoTicker> {
  const url = process.env.BITSO_TICKER_URL ?? "https://api.bitso.com/v3/ticker/?book=usdt_mxn";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bitso no disponible (HTTP ${res.status}).`);
  const data = tickerSchema.parse(await res.json());
  return {
    book: data.payload.book,
    bid: Number(data.payload.bid),
    ask: Number(data.payload.ask),
    last: Number(data.payload.last),
  };
}
