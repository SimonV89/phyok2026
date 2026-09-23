package com.phyok.memory.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.memory.application.config.MemoryProperties;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class MemoryQdrantClient {
    private final MemoryProperties memoryProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private volatile boolean collectionEnsured;

    public MemoryQdrantClient(MemoryProperties memoryProperties, ObjectMapper objectMapper) {
        this.memoryProperties = memoryProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(memoryProperties.getEmbeddingTimeoutMs(), 1000)))
                .build();
        this.collectionEnsured = false;
    }

    public void upsertMemoryFragment(MemoryFragmentDO fragment, List<Double> vector) {
        if (!memoryProperties.isQdrantEnabled()) {
            return;
        }
        ensureCollection();
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", fragment.getId());
        point.put("vector", vector);
        point.put("payload", buildPayload(fragment));
        post("/collections/%s/points?wait=true".formatted(memoryProperties.getQdrantCollection()), Map.of(
                "points", List.of(point)
        ));
    }

    public void deleteMemoryFragment(String fragmentId) {
        if (!memoryProperties.isQdrantEnabled()) {
            return;
        }
        ensureCollection();
        post("/collections/%s/points/delete?wait=true".formatted(memoryProperties.getQdrantCollection()), Map.of(
                "points", List.of(fragmentId)
        ));
    }

    public List<SearchHit> searchMemory(
            String tenantId,
            String appId,
            String userId,
            List<Double> queryVector,
            int limit,
            Double minScore,
            List<String> timelineRoots,
            List<String> topicTags
    ) {
        if (!memoryProperties.isQdrantEnabled()) {
            return List.of();
        }
        ensureCollection();
        Map<String, Object> filter = new LinkedHashMap<>();
        List<Map<String, Object>> must = new ArrayList<>();
        must.add(match("tenant_id", tenantId));
        must.add(match("app_id", appId));
        must.add(match("user_id", userId));
        must.add(match("deleted", false));
        must.add(match("searchable", true));
        if (timelineRoots != null && !timelineRoots.isEmpty()) {
            must.add(matchAny("timeline_root", timelineRoots));
        }
        if (topicTags != null && !topicTags.isEmpty()) {
            must.add(matchAny("topic_tags", topicTags));
        }
        filter.put("must", must);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vector", queryVector);
        body.put("limit", limit);
        body.put("with_payload", true);
        body.put("filter", filter);
        if (minScore != null && minScore > 0d) {
            body.put("score_threshold", minScore);
        }

        JsonNode root = post("/collections/%s/points/search".formatted(memoryProperties.getQdrantCollection()), body);
        JsonNode resultNode = root.path("result");
        if (!resultNode.isArray()) {
            return List.of();
        }
        List<SearchHit> hits = new ArrayList<>();
        for (JsonNode item : resultNode) {
            JsonNode payload = item.path("payload");
            hits.add(new SearchHit(
                    payload.path("memory_fragment_id").asText(item.path("id").asText("")),
                    item.path("score").asDouble(0d)
            ));
        }
        return hits;
    }

    private synchronized void ensureCollection() {
        if (collectionEnsured) {
            return;
        }
        put("/collections/%s".formatted(memoryProperties.getQdrantCollection()), Map.of(
                "vectors", Map.of(
                        "size", memoryProperties.getQdrantVectorDimension(),
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
            post("/collections/%s/index".formatted(memoryProperties.getQdrantCollection()), Map.of(
                    "field_name", fieldName,
                    "field_schema", schema
            ));
        } catch (Exception ignored) {
            // Ignore duplicate index creation errors to keep initialization idempotent.
        }
    }

    private Map<String, Object> buildPayload(MemoryFragmentDO fragment) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenant_id", fragment.getTenantId());
        payload.put("app_id", fragment.getAppId());
        payload.put("user_id", fragment.getUserId());
        payload.put("memory_fragment_id", fragment.getId());
        payload.put("fragment_type", fragment.getFragmentType());
        payload.put("visibility", fragment.getVisibility());
        payload.put("deleted", fragment.isDeleted());
        payload.put("searchable", fragment.isSearchable());
        payload.put("time_bucket", fragment.getTimeBucket());
        payload.put("timeline_root", fragment.getTimelineRoot());
        payload.put("topic_tags", splitTags(fragment.getTopicTags()));
        payload.put("emotion_tags", splitTags(fragment.getEmotionTags()));
        payload.put("embedding_model", memoryProperties.getEmbeddingModel());
        payload.put("embedding_version", memoryProperties.getQdrantEmbeddingVersion());
        payload.put("created_at", fragment.getCreatedAt() == null ? null : fragment.getCreatedAt().toEpochSecond());
        payload.put("updated_at", java.time.OffsetDateTime.now().toEpochSecond());
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
                    .timeout(Duration.ofMillis(Math.max(memoryProperties.getEmbeddingTimeoutMs(), 1000)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json");
            if (!memoryProperties.getQdrantApiKey().isBlank()) {
                builder.header("api-key", memoryProperties.getQdrantApiKey());
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
        String baseUrl = memoryProperties.getQdrantUrl();
        if (baseUrl.endsWith("/") && path.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + path;
        }
        if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
            return baseUrl + "/" + path;
        }
        return baseUrl + path;
    }

    private Map<String, Object> match(String key, Object value) {
        return Map.of("key", key, "match", Map.of("value", value));
    }

    private Map<String, Object> matchAny(String key, List<String> values) {
        return Map.of("key", key, "match", Map.of("any", values));
    }

    private List<String> splitTags(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split("\\|"))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(6)
                .toList();
    }

    public record SearchHit(String fragmentId, double score) {
    }
}
