package com.phyok.memoryembedding.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.memoryembedding.application.config.MemoryEmbeddingConsumerProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class MemoryEmbeddingProviderClient {
    private final MemoryEmbeddingConsumerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public MemoryEmbeddingProviderClient(MemoryEmbeddingConsumerProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(properties.getEmbeddingTimeoutMs(), 1000)))
                .build();
    }

    public List<Double> embed(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Embedding text must not be blank.");
        }
        if (properties.getEmbeddingApiKey().isBlank()) {
            throw new IllegalStateException("SILICONFLOW_API_KEY 未配置，无法生成 embedding。");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(buildEmbeddingsUrl()))
                    .timeout(Duration.ofMillis(Math.max(properties.getEmbeddingTimeoutMs(), 1000)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + properties.getEmbeddingApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(writeRequestBody(text), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Embedding request failed, status=" + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode embeddingNode = root.path("data").path(0).path("embedding");
            if (!embeddingNode.isArray() || embeddingNode.isEmpty()) {
                throw new IllegalStateException("Embedding response missing vector.");
            }
            List<Double> vector = new ArrayList<>();
            for (JsonNode item : embeddingNode) {
                vector.add(item.asDouble());
            }
            return vector;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to call embedding provider.", exception);
        }
    }

    private String buildEmbeddingsUrl() {
        String baseUrl = properties.getEmbeddingBaseUrl();
        if (baseUrl.endsWith("/")) {
            return baseUrl + "embeddings";
        }
        return baseUrl + "/embeddings";
    }

    private String writeRequestBody(String text) throws IOException {
        return objectMapper.writeValueAsString(Map.of(
                "model", properties.getEmbeddingModel(),
                "input", text
        ));
    }
}
