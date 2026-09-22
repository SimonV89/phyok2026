package com.phyok.tenant.infrastructure.mybatis.mapper;

import com.phyok.tenant.infrastructure.mybatis.entity.TenantAppContextDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TenantContextMapper {
    TenantAppContextDO selectTenantAppContext(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId
    );

    int softDeleteTenant(
            @Param("tenantId") String tenantId
    );

    int softDeleteApp(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId
    );
}
