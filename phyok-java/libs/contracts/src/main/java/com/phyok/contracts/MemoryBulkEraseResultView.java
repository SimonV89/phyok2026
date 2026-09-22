package com.phyok.contracts;

public record MemoryBulkEraseResultView(
        String tenantId,
        String appId,
        String userId,
        int affectedCount
) {
}
