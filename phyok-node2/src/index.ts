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
import { mediaV2Routes } from "./modules/media-v2/routes";
import { createSuccess, extractExternalHeaders } from "./packages/contracts/api";

async function buildServer() {
  const app = Fastify({
    logger: {
      level: "info",
      timestamp: () => `,"time":"${new Date().toISOString()}"`
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [env.clientBaseUrl],
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
  await app.register(auditV2Routes, { prefix: "/v2/audits" });

  await app.register(
    async (legacy) => {
      legacy.get("/health", async (request) =>
        createSuccess(request.id, {
          ok: true,
          name: "phyok-node2",
          ts: Date.now(),
          legacy: true
        })
      );
      await legacy.register(chatV2Routes, { prefix: "/v2/chat" });
      await legacy.register(mediaV2Routes, { prefix: "/v2/media" });
      await legacy.register(authV2Routes, { prefix: "/v2/auth" });
      await legacy.register(billingV2Routes, { prefix: "/v2/billing" });
      await legacy.register(auditV2Routes, { prefix: "/v2/audits" });
    },
    { prefix: "/app" }
  );

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
