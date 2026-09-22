package com.phyok.contracts;

public record TenantPrivacyEraseResultView(
        String tenantId,
        String appId,
        String scope,
        int affectedCount,
        boolean tenantErased,
        boolean appErased
) {
}
