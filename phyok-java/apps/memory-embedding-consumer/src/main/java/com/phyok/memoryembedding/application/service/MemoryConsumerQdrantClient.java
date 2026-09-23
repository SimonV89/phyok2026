package com.phyok.memoryembedding.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.contracts.MemoryProjectionEvent;
import com.phyok.memoryembedding.application.config.MemoryEmbeddingConsumerProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class MemoryConsumerQdrantClient {
    private final MemoryEmbeddingConsumerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private volatile boolean collectionEnsured;

    public MemoryConsumerQdrantClient(MemoryEmbeddingConsumerProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(properties.getEmbeddingTimeoutMs(), 1000)))
                .build();
        this.collectionEnsured = false;
    }

    public void upsertMemoryFragment(MemoryProjectionEvent event, List<Double> vector) {
        if (!properties.isQdrantEnabled()) {
            return;
        }
        ensureCollection();
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", event.fragmentId());
        point.put("vector", vector);
        point.put("payload", buildPayload(event));
        post("/collections/%s/points?wait=true".formatted(properties.getQdrantCollection()), Map.of(
                "points", List.of(point)
        ));
    }

    public void deleteMemoryFragment(String fragmentId) {
        if (!properties.isQdrantEnabled()) {
            return;
        }
        ensureCollection();
        post("/collections/%s/points/delete?wait=true".formatted(properties.getQdrantCollection()), Map.of(
                "points", List.of(fragmentId)
        ));
    }

    private synchronized void ensureCollection() {
        if (collectionEnsured) {
            return;
        }
        put("/collections/%s".formatted(properties.getQdrantCollection()), Map.of(
                "vectors", Map.of(
                        "size", properties.getQdrantVectorDimension(),
                        "distance", "Cosine"
                )
        ));
        ensureIndex("tenant_id", "keyword");
        ensureIndex("app_id", "keyword");
        ensureIndex("user_id", "keyword");
        ensureIndex("deleted", "bool");
        ensureIndex("searchable", "bool");
        ensureIndex("fragment_type", "keyword");
        ensureIndex("visibility", "keyword");
        ensureIndex("time_bucket", "keyword");
        ensureIndex("timeline_root", "keyword");
        collectionEnsured = true;
    }

    private void ensureIndex(String fieldName, String schema) {
        try {
            post("/collections/%s/index".formatted(properties.getQdrantCollection()), Map.of(
                    "field_name", fieldName,
                    "field_schema", schema
            ));
        } catch (Exception ignored) {
            // Keep initialization idempotent.
        }
    }

    private Map<String, Object> buildPayload(MemoryProjectionEvent event) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenant_id", event.tenantId());
        payload.put("app_id", event.appId());
        payload.put("user_id", event.userId());
        payload.put("memory_fragment_id", event.fragmentId());
        payload.put("fragment_type", event.fragmentType());
        payload.put("visibility", event.visibility());
        payload.put("deleted", event.deleted());
        payload.put("searchable", event.searchable());
        payload.put("time_bucket", event.timeBucket());
        payload.put("timeline_root", event.timelineRoot());
        payload.put("topic_tags", event.topicTags());
        payload.put("emotion_tags", event.emotionTags());
        payload.put("embedding_model", properties.getEmbeddingModel());
        payload.put("embedding_version", properties.getQdrantEmbeddingVersion());
        payload.put("created_at", event.createdAt());
        payload.put("updated_at", OffsetDateTime.now().toEpochSecond());
        return payload;
    }

    private JsonNode post(String path, Map<String, Object> body) {
        return send("POST", path, body);
    }

    private JsonNode put(String path, Map<String, Object> body) {
        return send("PUT", path, body);
    }

    private JsonNode send(String method, String path, Map<String, Object> body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(buildUrl(path)))
                    .timeout(Duration.ofMillis(Math.max(properties.getEmbeddingTimeoutMs(), 1000)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json");
            if (!properties.getQdrantApiKey().isBlank()) {
                builder.header("api-key", properties.getQdrantApiKey());
            }
            String requestJson = objectMapper.writeValueAsString(body);
            if ("PUT".equalsIgnoreCase(method)) {
                builder.PUT(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8));
            } else {
                builder.POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8));
            }
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            String bodyText = response.body() == null ? "" : response.body();
            if (response.statusCode() >= 400 && !bodyText.contains("already exists")) {
                throw new IllegalStateException("Qdrant request failed, status=" + response.statusCode() + ", body=" + bodyText);
            }
            return bodyText.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(bodyText);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to call Qdrant.", exception);
        }
    }

    private String buildUrl(String path) {
        String baseUrl = properties.getQdrantUrl();
        if (baseUrl.endsWith("/") && path.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + path;
        }
        if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
            return baseUrl + "/" + path;
        }
        return baseUrl + path;
    }
}
