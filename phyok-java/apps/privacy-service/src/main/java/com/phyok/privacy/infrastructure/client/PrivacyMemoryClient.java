package com.phyok.privacy.infrastructure.client;

import com.phyok.contracts.MemoryBulkEraseResultView;
import com.phyok.contracts.ApiResponse;
import com.phyok.privacy.application.config.PrivacyProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class PrivacyMemoryClient {
    private static final Logger log = LoggerFactory.getLogger(PrivacyMemoryClient.class);
    private final RestClient restClient;

    public PrivacyMemoryClient(
            RestClient.Builder restClientBuilder,
            PrivacyProperties privacyProperties
    ) {
        this.restClient = restClientBuilder.baseUrl(privacyProperties.getMemoryBaseUrl()).build();
    }

    public int eraseUserMemories(String requestId, String tenantId, String appId, String userId) {
        try {
            ApiResponse<?> response = restClient.post()
                    .uri("/internal/memory/erase-user")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Request-Id", requestId)
                    .body(Map.of(
                            "tenantId", tenantId,
                            "appId", appId,
                            "userId", userId
                    ))
                    .retrieve()
                    .body(ApiResponse.class);
            if (response == null || response.data() == null) {
                return 0;
            }
            Object data = response.data();
            if (data instanceof Map<?, ?> map) {
                Object affectedCount = map.get("affectedCount");
                return affectedCount == null ? 0 : Integer.parseInt(String.valueOf(affectedCount));
            }
            if (data instanceof MemoryBulkEraseResultView result) {
                return result.affectedCount();
            }
            return 0;
        } catch (Exception exception) {
            log.warn("Failed to erase memories from privacy-service, requestId={}", requestId, exception);
            throw exception;
        }
    }
}
