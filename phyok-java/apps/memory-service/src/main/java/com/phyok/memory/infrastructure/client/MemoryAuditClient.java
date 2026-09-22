package com.phyok.memory.infrastructure.client;

import com.phyok.memory.application.config.MemoryProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class MemoryAuditClient {
    private static final Logger log = LoggerFactory.getLogger(MemoryAuditClient.class);
    private final RestClient restClient;
    private final MemoryProperties memoryProperties;

    public MemoryAuditClient(
            RestClient.Builder restClientBuilder,
            MemoryProperties memoryProperties
    ) {
        this.restClient = restClientBuilder.baseUrl(memoryProperties.getAuditBaseUrl()).build();
        this.memoryProperties = memoryProperties;
    }

    public void publishEvent(String requestId, String traceId, Map<String, Object> payload) {
        if (!memoryProperties.isAuditEnabled()) {
            return;
        }
        try {
            restClient.post()
                    .uri("/internal/audit/trace-event")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Request-Id", requestId)
                    .header("X-Trace-Id", traceId)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception exception) {
            log.warn("Failed to publish memory audit event, requestId={}", requestId, exception);
        }
    }
}
