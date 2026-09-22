package com.phyok.tenant.application.service;

import com.phyok.contracts.TenantPrivacyEraseResultView;
import com.phyok.tenant.infrastructure.repository.TenantContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantPrivacyCommandService {
    private final TenantContextRepository tenantContextRepository;

    public TenantPrivacyCommandService(TenantContextRepository tenantContextRepository) {
        this.tenantContextRepository = tenantContextRepository;
    }

    @Transactional
    public TenantPrivacyEraseResultView applyPrivacyErase(String tenantId, String appId, String scope) {
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeScope = defaultIfBlank(scope, "USER_FULL_ERASURE");
        int affectedCount = 0;
        boolean tenantErased = false;
        boolean appErased = false;

        if ("TENANT_FULL_ERASURE".equalsIgnoreCase(safeScope)) {
            int tenantAffected = tenantContextRepository.softDeleteTenant(safeTenantId);
            int appAffected = tenantContextRepository.softDeleteApp(safeTenantId, safeAppId);
            affectedCount = tenantAffected + appAffected;
            tenantErased = tenantAffected > 0;
            appErased = appAffected > 0;
        } else if ("APP_FULL_ERASURE".equalsIgnoreCase(safeScope)) {
            int appAffected = tenantContextRepository.softDeleteApp(safeTenantId, safeAppId);
            affectedCount = appAffected;
            appErased = appAffected > 0;
        }

        return new TenantPrivacyEraseResultView(
                safeTenantId,
                safeAppId,
                safeScope,
                affectedCount,
                tenantErased,
                appErased
        );
    }

    private String defaultIfBlank(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }
}
