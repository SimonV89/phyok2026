package com.phyok.tenant.infrastructure.repository;

import com.phyok.tenant.infrastructure.mybatis.entity.TenantAppContextDO;
import com.phyok.tenant.infrastructure.mybatis.mapper.TenantContextMapper;
import org.springframework.stereotype.Repository;

@Repository
public class TenantContextRepository {
    private final TenantContextMapper tenantContextMapper;

    public TenantContextRepository(TenantContextMapper tenantContextMapper) {
        this.tenantContextMapper = tenantContextMapper;
    }

    public TenantAppContextDO findTenantAppContext(String tenantId, String appId) {
        return tenantContextMapper.selectTenantAppContext(tenantId, appId);
    }

    public int softDeleteTenant(String tenantId) {
        return tenantContextMapper.softDeleteTenant(tenantId);
    }

    public int softDeleteApp(String tenantId, String appId) {
        return tenantContextMapper.softDeleteApp(tenantId, appId);
    }
}
