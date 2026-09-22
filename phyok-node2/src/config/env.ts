import dotenv from "dotenv";

dotenv.config();

function readInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export const env = {
  port: readInt(process.env.PORT, 3002),
  clientBaseUrl: process.env.CLIENT_BASE_URL ?? "http://127.0.0.1:3001",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://127.0.0.1:3002",
  domainClientMode: process.env.DOMAIN_CLIENT_MODE === "mock" ? "mock" : "http",
  javaDomainBaseUrl: process.env.JAVA_DOMAIN_BASE_URL ?? "http://127.0.0.1:8080",
  javaAuthBaseUrl: process.env.JAVA_AUTH_BASE_URL ?? "http://127.0.0.1:18081",
  javaBillingBaseUrl: process.env.JAVA_BILLING_BASE_URL ?? "http://127.0.0.1:18085",
  javaAuditBaseUrl: process.env.JAVA_AUDIT_BASE_URL ?? "http://127.0.0.1:18087",
  memoryTransport: process.env.MEMORY_TRANSPORT === "grpc" ? "grpc" : "http"
};
