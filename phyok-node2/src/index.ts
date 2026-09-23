import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { env } from "./config/env";
import { auditV2Routes } from "./modules/audit-v2/routes";
import { authV2Routes } from "./modules/auth-v2/routes";
import { billingV2Routes } from "./modules/billing-v2/routes";
import { chatV2Routes } from "./modules/chat-v2/routes";
import { memoryV2Routes } from "./modules/memory-v2/routes";
import { mediaV2Routes } from "./modules/media-v2/routes";
import { paymentsV2Routes } from "./modules/payments-v2/routes";
import { createSuccess, extractExternalHeaders } from "./packages/contracts/api";

function createAllowedOrigins(): string[] {
  const baseOrigins = new Set<string>([env.clientBaseUrl]);

  for (const raw of [env.clientBaseUrl, env.appBaseUrl]) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === "127.0.0.1") {
        baseOrigins.add(`${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`);
      }
      if (parsed.hostname === "localhost") {
        baseOrigins.add(`${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ""}`);
      }
    } catch {
      // Ignore invalid local URLs and keep explicit env values only.
    }
  }

  return [...baseOrigins];
}

async function buildServer() {
  const app = Fastify({
    logger: {
      level: "info",
      timestamp: () => `,"time":"${new Date().toISOString()}"`
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  const allowedOrigins = createAllowedOrigins();
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: false
  });
  await app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024,
      files: 1,
      fields: 8
    }
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: "1 minute"
  });

  app.addHook("onRequest", async (request) => {
    const headers = extractExternalHeaders(request.headers);
    request.log = request.log.child({
      requestId: headers.requestId,
      traceId: headers.traceId,
      appId: headers.appId,
      deviceId: headers.deviceId
    });
    request.log.info({ method: request.method, url: request.url }, "request.started");
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({ statusCode: reply.statusCode }, "request.completed");
  });

  app.get("/health", async (request) =>
    createSuccess(request.id, {
      ok: true,
      name: "phyok-node2",
      ts: Date.now()
    })
  );

  await app.register(chatV2Routes, { prefix: "/v2/chat" });
  await app.register(mediaV2Routes, { prefix: "/v2/media" });
  await app.register(authV2Routes, { prefix: "/v2/auth" });
  await app.register(billingV2Routes, { prefix: "/v2/billing" });
  await app.register(paymentsV2Routes, { prefix: "/v2/payments" });
  await app.register(memoryV2Routes, { prefix: "/v2/memories" });
  await app.register(auditV2Routes, { prefix: "/v2/audits" });

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({
      port: env.port,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
