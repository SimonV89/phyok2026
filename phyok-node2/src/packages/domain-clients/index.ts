import { env } from "../../config/env";
import { GrpcJavaDomainClient } from "./grpc-java-domain-client";
import { HttpJavaDomainClient } from "./http-java-domain-client";
import { createMockDomainClients } from "./mock-domain-clients";
import type { DomainClients } from "./types";

let cachedClients: DomainClients | null = null;

function createDomainClients(): DomainClients {
  const mockClient = createMockDomainClients();

  if (env.domainClientMode === "http") {
    const httpClient = new HttpJavaDomainClient({
      defaultBaseUrl: env.javaDomainBaseUrl,
      authBaseUrl: env.javaAuthBaseUrl,
      billingBaseUrl: env.javaBillingBaseUrl,
      auditBaseUrl: env.javaAuditBaseUrl
    });

    const hybridHttpClient: DomainClients = {
      verifyToken: (ctx) => httpClient.verifyToken(ctx),
      getMemoryGate: (ctx, query) => httpClient.getMemoryGate(ctx, query),
      recallMemory: (query, ctx) => httpClient.recallMemory(query, ctx),
      recallKnowledge: (query, ctx) => mockClient.recallKnowledge(query, ctx),
      upsertMemoryPlan: (query, ctx) => mockClient.upsertMemoryPlan(query, ctx),
      createMemoryFragment: (input, ctx) => httpClient.createMemoryFragment(input, ctx),
      emitAuditTrace: (ctx, phase) => httpClient.emitAuditTrace(ctx, phase),
      precheckBilling: (ctx) => httpClient.precheckBilling(ctx)
    };

    if (env.memoryTransport === "grpc") {
      return new GrpcJavaDomainClient({
        fallback: hybridHttpClient
      });
    }

    return hybridHttpClient;
  }

  return mockClient;
}

export function getDomainClients(): DomainClients {
  if (!cachedClients) {
    cachedClients = createDomainClients();
  }
  return cachedClients;
}

export type { DomainClients, GatewayContext } from "./types";
