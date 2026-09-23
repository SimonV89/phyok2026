import {
  createFailure,
  type ApiFailure,
  type ApiSuccess,
  type ExternalRequestHeaders
} from "../contracts/api";

type JsonEnvelope<T> = ApiSuccess<T> | ApiFailure;

export async function proxyJavaJson<T>(options: {
  baseUrl: string;
  path: string;
  method: "GET" | "POST";
  headers: ExternalRequestHeaders;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}): Promise<JsonEnvelope<T>> {
  const url = new URL(options.path, options.baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (typeof value === "string" && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    method: options.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Request-Id": options.headers.requestId,
      "X-Trace-Id": options.headers.traceId,
      "X-App-Id": options.headers.appId,
      ...(options.headers.clientVersion ? { "X-Client-Version": options.headers.clientVersion } : {}),
      ...(options.headers.deviceId ? { "X-Device-Id": options.headers.deviceId } : {}),
      ...(options.headers.userId ? { "X-User-Id": options.headers.userId } : {}),
      ...(options.headers.sessionId ? { "X-Session-Id": options.headers.sessionId } : {}),
      ...(options.headers.userEmail ? { "X-User-Email": options.headers.userEmail } : {}),
      ...(options.headers.authorization ? { Authorization: options.headers.authorization } : {}),
      ...(options.headers.idempotencyKey ? { "Idempotency-Key": options.headers.idempotencyKey } : {})
    },
    body: options.method === "GET" ? undefined : JSON.stringify(options.body ?? {})
  });

  const payload = (await response.json().catch(() => null)) as JsonEnvelope<T> | null;
  if (!payload) {
    return createFailure(options.headers.requestId, "JAVA_PROXY_BAD_RESPONSE", `Invalid JSON from ${options.path}`);
  }
  if (!response.ok) {
    return payload.code === "OK"
      ? createFailure(options.headers.requestId, "JAVA_PROXY_HTTP_ERROR", `Request failed: ${options.path}`)
      : payload;
  }
  return payload;
}
