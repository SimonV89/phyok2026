package com.phyok.privacy.infrastructure.client;

import com.phyok.privacy.application.config.PrivacyProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class PrivacyAuditClient {
    private static final Logger log = LoggerFactory.getLogger(PrivacyAuditClient.class);
    private final RestClient restClient;
    private final PrivacyProperties privacyProperties;

    public PrivacyAuditClient(
            RestClient.Builder restClientBuilder,
            PrivacyProperties privacyProperties
    ) {
        this.restClient = restClientBuilder.baseUrl(privacyProperties.getAuditBaseUrl()).build();
        this.privacyProperties = privacyProperties;
    }

    public void publishEvent(String requestId, String traceId, Map<String, Object> payload) {
        if (!privacyProperties.isAuditEnabled()) {
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
            log.warn("Failed to publish privacy audit event, requestId={}", requestId, exception);
        }
    }
}
