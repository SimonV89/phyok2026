import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

export type ApiSuccess<T> = {
  code: "OK";
  message: "success";
  requestId: string;
  data: T;
};

export type ApiFailure = {
  code: string;
  message: string;
  requestId: string;
  data?: Record<string, unknown>;
};

export type ExternalRequestHeaders = {
  authorization?: string;
  requestId: string;
  traceId: string;
  appId: string;
  clientVersion?: string;
  deviceId?: string;
  userEmail?: string;
  idempotencyKey?: string;
};

export type InternalRequestHeaders = {
  authorization?: string;
  requestId: string;
  traceId: string;
  tenantId?: string;
  appId: string;
  userId: string;
  sessionId: string;
  callerService: string;
};

export type GrpcMetadataRecord = Record<string, string>;

export const EXTERNAL_HEADER_NAMES = {
  authorization: "authorization",
  requestId: "x-request-id",
  traceId: "x-trace-id",
  appId: "x-app-id",
  clientVersion: "x-client-version",
  deviceId: "x-device-id",
  userEmail: "x-user-email",
  idempotencyKey: "idempotency-key"
} as const;

export const INTERNAL_HEADER_NAMES = {
  authorization: "authorization",
  requestId: "x-request-id",
  traceId: "x-trace-id",
  tenantId: "x-tenant-id",
  appId: "x-app-id",
  userId: "x-user-id",
  sessionId: "x-session-id",
  callerService: "x-caller-service"
} as const;

function pickHeaderValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0]?.trim();
  }
  return value?.trim();
}

export function extractExternalHeaders(headers: IncomingHttpHeaders): ExternalRequestHeaders {
  const requestId = pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.requestId) || `req_${randomUUID()}`;
  return {
    authorization: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.authorization),
    requestId,
    traceId: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.traceId) || requestId,
    appId: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.appId) || "phyok-chat-web",
    clientVersion: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.clientVersion),
    deviceId: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.deviceId),
    userEmail: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.userEmail),
    idempotencyKey: pickHeaderValue(headers, EXTERNAL_HEADER_NAMES.idempotencyKey)
  };
}

export function buildInternalHeaders(input: {
  requestId: string;
  traceId?: string;
  tenantId?: string;
  appId: string;
  userId: string;
  sessionId: string;
  authorization?: string;
  callerService?: string;
}): InternalRequestHeaders {
  return {
    authorization: input.authorization,
    requestId: input.requestId,
    traceId: input.traceId || input.requestId,
    tenantId: input.tenantId,
    appId: input.appId,
    userId: input.userId,
    sessionId: input.sessionId,
    callerService: input.callerService || "api-bff-gateway"
  };
}

export function buildGrpcMetadata(headers: InternalRequestHeaders): GrpcMetadataRecord {
  const metadata: GrpcMetadataRecord = {
    [INTERNAL_HEADER_NAMES.requestId]: headers.requestId,
    [INTERNAL_HEADER_NAMES.traceId]: headers.traceId,
    [INTERNAL_HEADER_NAMES.appId]: headers.appId,
    [INTERNAL_HEADER_NAMES.userId]: headers.userId,
    [INTERNAL_HEADER_NAMES.sessionId]: headers.sessionId,
    [INTERNAL_HEADER_NAMES.callerService]: headers.callerService
  };

  if (headers.authorization) {
    metadata[INTERNAL_HEADER_NAMES.authorization] = headers.authorization;
  }
  if (headers.tenantId) {
    metadata[INTERNAL_HEADER_NAMES.tenantId] = headers.tenantId;
  }
  return metadata;
}

export const ERROR_CODES = {
  BFF_BAD_REQUEST: "BFF_BAD_REQUEST",
  BFF_UNAUTHORIZED: "BFF_UNAUTHORIZED",
  BFF_RATE_LIMITED: "BFF_RATE_LIMITED",
  BFF_UNSUPPORTED_MEDIA_TYPE: "BFF_UNSUPPORTED_MEDIA_TYPE",
  BFF_RUN_NOT_FOUND: "BFF_RUN_NOT_FOUND",
  GRAPH_EXECUTION_FAILED: "GRAPH_EXECUTION_FAILED",
  SSE_STREAM_ABORTED: "SSE_STREAM_ABORTED",
  MEMORY_GATE_NOT_MET: "MEMORY_GATE_NOT_MET",
  CAPABILITY_PARSE_FAILED: "CAPABILITY_PARSE_FAILED"
} as const;

export function createSuccess<T>(requestId: string, data: T): ApiSuccess<T> {
  return {
    code: "OK",
    message: "success",
    requestId,
    data
  };
}

export function createFailure(
  requestId: string,
  code: string,
  message: string,
  data?: Record<string, unknown>
): ApiFailure {
  return {
    code,
    message,
    requestId,
    data
  };
}
