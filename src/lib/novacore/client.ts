import { randomUUID } from "node:crypto";
import type {
  ReconcilePage,
  ReconcileParams,
  SpeiDispatchRequest,
  SpeiDispatchResult,
} from "./types";

/**
 * Cliente del core bancario. `getCoreClient` devuelve el cliente real de
 * NovaCore o un mock para desarrollo local (USE_MOCK_CORE=1), de modo que
 * podamos construir y probar todo el flujo sin credenciales reales.
 */
export interface CoreClient {
  dispatchSpei(req: SpeiDispatchRequest): Promise<SpeiDispatchResult>;
  listDeposits(params: ReconcileParams): Promise<ReconcilePage>;
}

export type CoreCreds = {
  baseUrl: string;
  apiKey: string; // plaintext (ya desencriptado)
};

class NovacoreClient implements CoreClient {
  constructor(private readonly creds: CoreCreds) {}

  private url(path: string) {
    return new URL(path, this.creds.baseUrl).toString();
  }

  async dispatchSpei(req: SpeiDispatchRequest): Promise<SpeiDispatchResult> {
    const res = await fetch(this.url("/api/integrations/spei-dispatch"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.creds.apiKey,
      },
      body: JSON.stringify({
        beneficiaryAccount: req.beneficiaryAccount,
        beneficiaryName: req.beneficiaryName,
        amount: req.amount,
        concept: req.concept,
        externalReference: req.externalReference,
        beneficiaryRfc: req.beneficiaryRfc ?? "",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as Partial<SpeiDispatchResult>;
    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return {
      success: true,
      transactionId: data.transactionId,
      trackingKey: data.trackingKey,
      status: data.status ?? "sent",
    };
  }

  async listDeposits(params: ReconcileParams): Promise<ReconcilePage> {
    const q = new URLSearchParams({ since: params.since });
    if (params.until) q.set("until", params.until);
    if (params.status) q.set("status", params.status);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.cursor) q.set("cursor", params.cursor);

    const res = await fetch(this.url(`/api/integrations/spei-deposits?${q.toString()}`), {
      method: "GET",
      headers: { "X-API-Key": this.creds.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Reconciliación falló: HTTP ${res.status}`);
    }
    return (await res.json()) as ReconcilePage;
  }
}

class MockCoreClient implements CoreClient {
  async dispatchSpei(req: SpeiDispatchRequest): Promise<SpeiDispatchResult> {
    return {
      success: true,
      transactionId: `tx_api_${randomUUID()}`,
      trackingKey: `MOCK${Date.now()}`,
      status: "sent",
    };
  }

  async listDeposits(): Promise<ReconcilePage> {
    return { deposits: [], nextCursor: null };
  }
}

export function getCoreClient(creds: CoreCreds): CoreClient {
  if (process.env.USE_MOCK_CORE === "1") return new MockCoreClient();
  return new NovacoreClient(creds);
}

export { NovacoreClient, MockCoreClient };
