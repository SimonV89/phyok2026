package com.phyok.auth.infrastructure.client;

import com.phyok.auth.application.config.AuthEmailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class AuthAuditClient {
    private static final Logger log = LoggerFactory.getLogger(AuthAuditClient.class);
    private final RestClient restClient;
    private final AuthEmailProperties properties;

    public AuthAuditClient(
            RestClient.Builder restClientBuilder,
            AuthEmailProperties properties
    ) {
        this.restClient = restClientBuilder.baseUrl(properties.getAuditBaseUrl()).build();
        this.properties = properties;
    }

    public void publishEvent(String requestId, String traceId, Map<String, Object> payload) {
        if (!properties.isAuditEnabled()) {
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
            log.warn("Failed to publish auth audit event, requestId={}", requestId, exception);
        }
    }
}
