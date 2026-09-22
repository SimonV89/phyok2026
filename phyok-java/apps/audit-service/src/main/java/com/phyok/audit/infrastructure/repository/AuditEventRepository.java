package com.phyok.audit.infrastructure.repository;

import com.phyok.audit.infrastructure.mybatis.entity.AuditEventDO;
import com.phyok.audit.infrastructure.mybatis.mapper.AuditEventMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class AuditEventRepository {
    private final AuditEventMapper auditEventMapper;

    public AuditEventRepository(AuditEventMapper auditEventMapper) {
        this.auditEventMapper = auditEventMapper;
    }

    public int save(AuditEventDO auditEvent) {
        return auditEventMapper.insert(auditEvent);
    }

    public int countEvents(
            String tenantId,
            String appId,
            String userId,
            String eventType,
            String entityType,
            String entityId
    ) {
        return auditEventMapper.countEvents(tenantId, appId, userId, eventType, entityType, entityId);
    }

    public List<AuditEventDO> findEventsPage(
            String tenantId,
            String appId,
            String userId,
            String eventType,
            String entityType,
            String entityId,
            int limit,
            int offset
    ) {
        return auditEventMapper.selectEventsPage(
                tenantId,
                appId,
                userId,
                eventType,
                entityType,
                entityId,
                limit,
                offset
        );
    }
}
