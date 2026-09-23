package com.phyok.contracts;

import java.time.OffsetDateTime;

public record ComplaintTicketView(
        String complaintId,
        String tenantId,
        String appId,
        String userId,
        String category,
        String status,
        String reporter,
        String summary,
        int affectedCount,
        String sourceType,
        OffsetDateTime createdAt
) {
}
