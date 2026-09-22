package com.phyok.contracts;

public record TenantContextView(
        String tenantId,
        String appId,
        String tenantCode,
        String appCode,
        String plan
) {
}
