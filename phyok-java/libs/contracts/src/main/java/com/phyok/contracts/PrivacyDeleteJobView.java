package com.phyok.contracts;

import java.time.OffsetDateTime;

public record PrivacyDeleteJobView(
        String jobId,
        String tenantId,
        String appId,
        String userId,
        String scope,
        String status,
        int affectedCount,
        String requestedBy,
        String reason,
        OffsetDateTime createdAt
) {
}
