package com.phyok.audit.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.audit.infrastructure.mybatis.entity.AuditEventDO;
import com.phyok.audit.infrastructure.repository.AuditEventRepository;
import com.phyok.contracts.AuditEventPageView;
import com.phyok.contracts.AuditEventView;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditTraceService {
    private final AuditEventRepository auditEventRepository;
    private final ObjectMapper objectMapper;

    public AuditTraceService(
            AuditEventRepository auditEventRepository,
            ObjectMapper objectMapper
    ) {
        this.auditEventRepository = auditEventRepository;
        this.objectMapper = objectMapper;
    }

    public void append(String phase, String requestId, String traceId, Map<String, Object> payload) {
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        AuditEventDO auditEvent = new AuditEventDO();
        auditEvent.setId(generateId());
        auditEvent.setTenantId(stringValue(safePayload.get("tenantId"), "tenant-demo"));
        auditEvent.setAppId(stringValue(safePayload.get("appId"), "app-self-explore"));
        auditEvent.setUserId(blankToNull(stringValue(safePayload.get("userId"), null)));
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
        auditEvent.setEventType(stringValue(safePayload.get("eventType"), "GRAPH_TRACE_" + phase.toUpperCase()));
        auditEvent.setSourceService(stringValue(safePayload.get("sourceService"), "audit-service"));
        auditEvent.setEntityType(blankToNull(stringValue(safePayload.get("entityType"), null)));
        auditEvent.setEntityId(blankToNull(stringValue(safePayload.get("entityId"), null)));
        auditEvent.setPayloadJson(toJson(safePayload));
        auditEvent.setCreatedAt(OffsetDateTime.now());
        auditEventRepository.save(auditEvent);
    }

    public AuditEventPageView search(
            String tenantId,
            String appId,
            String userId,
            String eventType,
            String entityType,
            String entityId,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int offset = (safePageNo - 1) * safePageSize;
        String safeTenantId = stringValue(tenantId, "tenant-demo");
        String safeAppId = stringValue(appId, "app-self-explore");
        String safeUserId = blankToNull(userId);
        String safeEventType = blankToNull(eventType);
        String safeEntityType = blankToNull(entityType);
        String safeEntityId = blankToNull(entityId);
        int total = auditEventRepository.countEvents(
                safeTenantId,
                safeAppId,
                safeUserId,
                safeEventType,
                safeEntityType,
                safeEntityId
        );
        List<AuditEventView> items = auditEventRepository.findEventsPage(
                        safeTenantId,
                        safeAppId,
                        safeUserId,
                        safeEventType,
                        safeEntityType,
                        safeEntityId,
                        safePageSize,
                        offset
                ).stream()
                .map(this::toView)
                .toList();
        return new AuditEventPageView(safePageNo, safePageSize, total, items);
    }

    public int totalEvents(String tenantId, String appId) {
        return auditEventRepository.countEvents(
                stringValue(tenantId, "tenant-demo"),
                stringValue(appId, "app-self-explore"),
                null,
                null,
                null,
                null
        );
    }

    private AuditEventView toView(AuditEventDO auditEvent) {
        return new AuditEventView(
                auditEvent.getId(),
                auditEvent.getTenantId(),
                auditEvent.getAppId(),
                auditEvent.getUserId(),
                auditEvent.getTraceId(),
                auditEvent.getRequestId(),
                auditEvent.getEventType(),
                auditEvent.getSourceService(),
                auditEvent.getEntityType(),
                auditEvent.getEntityId(),
                auditEvent.getPayloadJson(),
                auditEvent.getCreatedAt()
        );
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            return "{\"error\":\"payload_serialize_failed\"}";
        }
    }

    private String generateId() {
        return "audit_" + UUID.randomUUID().toString().replace("-", "");
    }

    private String stringValue(Object value, String defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        String normalized = String.valueOf(value).trim();
        return normalized.isEmpty() ? defaultValue : normalized;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
