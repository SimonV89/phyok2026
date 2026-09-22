package com.phyok.privacy.infrastructure.client;

import com.phyok.contracts.ApiResponse;
import com.phyok.privacy.application.config.PrivacyProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class PrivacyTenantClient {
    private static final Logger log = LoggerFactory.getLogger(PrivacyTenantClient.class);
    private final RestClient restClient;

    public PrivacyTenantClient(
            RestClient.Builder restClientBuilder,
            PrivacyProperties privacyProperties
    ) {
        this.restClient = restClientBuilder.baseUrl(privacyProperties.getTenantBaseUrl()).build();
    }

    public EraseSummary applyPrivacyErase(String requestId, String tenantId, String appId, String scope) {
        try {
            ApiResponse<?> response = restClient.post()
                    .uri("/internal/tenant/privacy-erase")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Request-Id", requestId)
                    .body(Map.of(
                            "tenantId", tenantId,
                            "appId", appId,
                            "scope", scope
                    ))
                    .retrieve()
                    .body(ApiResponse.class);
            if (response == null || response.data() == null) {
                return new EraseSummary(0, false, false);
            }
            Object data = response.data();
            if (data instanceof Map<?, ?> map) {
                int affectedCount = parseInt(map.get("affectedCount"));
                boolean tenantErased = Boolean.parseBoolean(String.valueOf(map.get("tenantErased")));
                boolean appErased = Boolean.parseBoolean(String.valueOf(map.get("appErased")));
                return new EraseSummary(affectedCount, tenantErased, appErased);
            }
            return new EraseSummary(0, false, false);
        } catch (Exception exception) {
            log.warn("Failed to apply tenant privacy erase from privacy-service, requestId={}", requestId, exception);
            throw exception;
        }
    }

    private int parseInt(Object value) {
        return value == null ? 0 : Integer.parseInt(String.valueOf(value));
    }

    public record EraseSummary(int affectedCount, boolean tenantErased, boolean appErased) {
    }
}
