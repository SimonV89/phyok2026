package com.phyok.contracts;

import java.time.OffsetDateTime;

public record AuditEventView(
        String id,
        String tenantId,
        String appId,
        String userId,
        String traceId,
        String requestId,
        String eventType,
        String sourceService,
        String entityType,
        String entityId,
        String payloadJson,
        OffsetDateTime createdAt
) {
}
