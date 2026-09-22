import {
  buildGrpcMetadata,
  buildInternalHeaders,
  type GrpcMetadataRecord,
  type InternalRequestHeaders
} from "./api";

export const GRPC_SERVICES = {
  memoryGate: "phyok.internal.memory.v1.MemoryGateService",
  memoryRecall: "phyok.internal.memory.v1.MemoryRecallService",
  multimodalCapability: "phyok.internal.capability.v1.MultimodalCapabilityService"
} as const;

export type MemoryGateCheckRequest = {
  userId: string;
  sessionId: string;
  conversationId?: string;
  requiredCount: number;
};

export type MemoryGateCheckResponse = {
  passed: boolean;
  currentCount: number;
  requiredCount: number;
};

export type GrpcCallEnvelope<TRequest> = {
  service: string;
  method: string;
  metadata: GrpcMetadataRecord;
  payload: TRequest;
};

export function createGrpcEnvelope<TRequest>(input: {
  service: string;
  method: string;
  requestId: string;
  traceId?: string;
  tenantId?: string;
  appId: string;
  userId: string;
  sessionId: string;
  authorization?: string;
  payload: TRequest;
}): GrpcCallEnvelope<TRequest> {
  const headers: InternalRequestHeaders = buildInternalHeaders({
    requestId: input.requestId,
    traceId: input.traceId,
    tenantId: input.tenantId,
    appId: input.appId,
    userId: input.userId,
    sessionId: input.sessionId,
    authorization: input.authorization,
    callerService: "agent-runtime-langgraph"
  });

  return {
    service: input.service,
    method: input.method,
    metadata: buildGrpcMetadata(headers),
    payload: input.payload
  };
}
