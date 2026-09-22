package com.phyok.tenant.application.service;

import com.phyok.contracts.TenantContextView;
import com.phyok.tenant.infrastructure.mybatis.entity.TenantAppContextDO;
import com.phyok.tenant.infrastructure.repository.TenantContextRepository;
import org.springframework.stereotype.Service;

@Service
public class TenantQueryService {
    private final TenantContextRepository tenantContextRepository;

    public TenantQueryService(TenantContextRepository tenantContextRepository) {
        this.tenantContextRepository = tenantContextRepository;
    }

    public TenantContextView getContext(String tenantId, String appId) {
        TenantAppContextDO context = tenantContextRepository.findTenantAppContext(tenantId, appId);
        if (context == null) {
            return new TenantContextView(tenantId, appId, "unknown", "unknown", "unknown");
        }
        return new TenantContextView(
                context.getTenantId(),
                context.getAppId(),
                context.getTenantCode(),
                context.getAppCode(),
                context.getPlanCode()
        );
    }
}
