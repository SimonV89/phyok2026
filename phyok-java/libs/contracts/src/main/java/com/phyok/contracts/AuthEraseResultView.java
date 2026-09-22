package com.phyok.contracts;

public record AuthEraseResultView(
        String tenantId,
        String appId,
        String userId,
        int revokedSessionCount,
        boolean accountErased
) {
}
