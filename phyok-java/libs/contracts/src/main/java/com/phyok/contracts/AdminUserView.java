package com.phyok.contracts;

import java.time.OffsetDateTime;

public record AdminUserView(
        String userId,
        String tenantId,
        String appId,
        String email,
        String displayName,
        String status,
        String registerSource,
        boolean deleted,
        long version,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        int activeSessionCount,
        OffsetDateTime latestSessionExpiresAt
) {
}
