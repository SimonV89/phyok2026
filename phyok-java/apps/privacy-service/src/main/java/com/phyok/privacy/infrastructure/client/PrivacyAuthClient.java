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
public class PrivacyAuthClient {
    private static final Logger log = LoggerFactory.getLogger(PrivacyAuthClient.class);
    private final RestClient restClient;

    public PrivacyAuthClient(
            RestClient.Builder restClientBuilder,
            PrivacyProperties privacyProperties
    ) {
        this.restClient = restClientBuilder.baseUrl(privacyProperties.getAuthBaseUrl()).build();
    }

    public EraseSummary eraseUserAuthData(String requestId, String tenantId, String appId, String userId) {
        try {
            ApiResponse<?> response = restClient.post()
                    .uri("/internal/auth/erase-user")
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
                return new EraseSummary(0, false);
            }
            Object data = response.data();
            if (data instanceof Map<?, ?> map) {
                int revokedSessionCount = parseInt(map.get("revokedSessionCount"));
                boolean accountErased = Boolean.parseBoolean(String.valueOf(map.get("accountErased")));
                return new EraseSummary(revokedSessionCount, accountErased);
            }
            return new EraseSummary(0, false);
        } catch (Exception exception) {
            log.warn("Failed to erase auth data from privacy-service, requestId={}", requestId, exception);
            throw exception;
        }
    }

    private int parseInt(Object value) {
        return value == null ? 0 : Integer.parseInt(String.valueOf(value));
    }

    public record EraseSummary(int revokedSessionCount, boolean accountErased) {
    }
}
