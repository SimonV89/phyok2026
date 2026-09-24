import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import Fastify from "fastify";

import { chatV2Routes } from "./routes";
import { billingV2Routes } from "../billing-v2/routes";
import { getOwnedUploadedAsset, saveUploadedAsset } from "../media-v2/asset-store";

const app = Fastify();
const originalFetch = globalThis.fetch;
const forwardedBillingEmails: string[] = [];

before(async () => {
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("/v2/billing/account")) {
      const email = new Headers(init?.headers).get("X-User-Email") ?? "";
      forwardedBillingEmails.push(email);
      return Response.json({ code: "OK", data: { plan: "starter", remainingTokens: 20 } });
    }
    const token = new Headers(init?.headers).get("Authorization");
    if (token === "Bearer valid-a" || token === "Bearer valid-b") {
      const userId = token === "Bearer valid-a" ? "user-a" : "user-b";
      return Response.json({
        code: "OK",
        data: {
          tenantId: "tenant-a",
          appId: "phyok-chat-web",
          userId,
          sessionId: `session-${userId}`,
          email: `${userId}@example.com`,
          roles: ["USER"]
        }
      });
    }
    return Response.json({ code: "OK", data: { userId: "unknown", roles: ["ANONYMOUS"] } });
  };
  await app.register(chatV2Routes, { prefix: "/v2/chat" });
  await app.register(billingV2Routes, { prefix: "/v2/billing" });
  await app.ready();
});

after(async () => {
  globalThis.fetch = originalFetch;
  await app.close();
});

test("forged identity headers without a token cannot list or read history", async () => {
  for (const url of ["/v2/chat/history/conversations", "/v2/chat/history?conversationId=other"]) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { "x-user-id": "user-a", "x-user-email": "user-a@example.com" }
    });
    assert.equal(response.statusCode, 401);
  }
});

test("authenticated history ignores forged user headers and rejects invalid tokens", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/v2/chat/history/conversations",
    headers: {
      authorization: "Bearer valid-b",
      "x-user-id": "user-a",
      "x-user-email": "user-a@example.com"
    }
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.items, []);

  const invalid = await app.inject({
    method: "DELETE",
    url: "/v2/chat/history/conversations/other",
    headers: { authorization: "Bearer invalid", "x-user-id": "user-a" }
  });
  assert.equal(invalid.statusCode, 401);
});

test("asset bytes are visible only to their verified owner", () => {
  const assetId = `asset_${randomUUID()}`;
  saveUploadedAsset({
    assetId,
    ownerScope: "verified:tenant-a:phyok-chat-web:user-a",
    fileName: "private.txt",
    mimeType: "text/plain",
    size: 6,
    kind: "document",
    buffer: Buffer.from("secret")
  });
  assert.equal(getOwnedUploadedAsset(assetId, "verified:tenant-a:phyok-chat-web:user-b"), undefined);
  assert.equal(getOwnedUploadedAsset(assetId, "verified:tenant-a:phyok-chat-web:user-a")?.buffer.toString(), "secret");
});

test("another authenticated user cannot attach a known asset id", async () => {
  const assetId = `asset_${randomUUID()}`;
  saveUploadedAsset({
    assetId,
    ownerScope: "verified:tenant-a:phyok-chat-web:user-a",
    fileName: "private.txt",
    mimeType: "text/plain",
    size: 6,
    kind: "document",
    buffer: Buffer.from("secret")
  });
  const response = await app.inject({
    method: "POST",
    url: "/v2/chat/send",
    headers: {
      authorization: "Bearer valid-b",
      "x-user-id": "user-a",
      "content-type": "application/json"
    },
    payload: {
      message: "读取这份附件",
      attachments: [{ id: assetId, name: "private.txt", mimeType: "text/plain", kind: "document" }]
    }
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /附件.*失效/);
});

test("billing uses the verified email instead of the supplied email header", async () => {
  const anonymous = await app.inject({
    method: "GET",
    url: "/v2/billing/account",
    headers: { "x-user-email": "user-a@example.com" }
  });
  assert.equal(anonymous.statusCode, 401);
  const response = await app.inject({
    method: "GET",
    url: "/v2/billing/account",
    headers: { authorization: "Bearer valid-b", "x-user-email": "user-a@example.com" }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(forwardedBillingEmails.at(-1), "user-b@example.com");
});
