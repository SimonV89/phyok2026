package com.phyok.audit.infrastructure.mybatis.mapper;

import com.phyok.audit.infrastructure.mybatis.entity.AuditEventDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AuditEventMapper {
    int insert(AuditEventDO auditEvent);

    int countEvents(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("eventType") String eventType,
            @Param("entityType") String entityType,
            @Param("entityId") String entityId
    );

    List<AuditEventDO> selectEventsPage(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("eventType") String eventType,
            @Param("entityType") String entityType,
            @Param("entityId") String entityId,
            @Param("limit") int limit,
            @Param("offset") int offset
    );
}
