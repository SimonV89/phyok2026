package com.phyok.audit.interfaces.controller;

import com.phyok.audit.application.service.AuditTraceService;
import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.AuditEventPageView;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class AuditController {
    private final AuditTraceService auditTraceService;

    public AuditController(AuditTraceService auditTraceService) {
        this.auditTraceService = auditTraceService;
    }

    @GetMapping("/v2/audits/events/search")
    public ApiResponse<AuditEventPageView> search(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "eventType", required = false) String eventType,
            @RequestParam(value = "entityType", required = false) String entityType,
            @RequestParam(value = "entityId", required = false) String entityId,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") Integer pageSize
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                auditTraceService.search(tenantId, appId, userId, eventType, entityType, entityId, pageNo, pageSize)
        );
    }

    @GetMapping("/internal/audit/ingest-status")
    public ApiResponse<Map<String, Object>> ingestStatus(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "kafkaConsumerLag", 0,
                "lastWriteStatus", "SUCCESS",
                "bufferedEvents", auditTraceService.totalEvents(tenantId, appId)
        ));
    }

    @PostMapping("/internal/audit/trace-start")
    public ApiResponse<Map<String, Object>> traceStart(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        auditTraceService.append("start", requestIdOrDefault(requestId), traceIdOrDefault(traceId, requestId), body);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("accepted", true));
    }

    @PostMapping("/internal/audit/trace-event")
    public ApiResponse<Map<String, Object>> traceEvent(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        auditTraceService.append("event", requestIdOrDefault(requestId), traceIdOrDefault(traceId, requestId), body);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("accepted", true));
    }

    @PostMapping("/internal/audit/trace-complete")
    public ApiResponse<Map<String, Object>> traceComplete(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        auditTraceService.append("complete", requestIdOrDefault(requestId), traceIdOrDefault(traceId, requestId), body);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("accepted", true));
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "audit-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-audit" : requestId;
    }

    private String traceIdOrDefault(String traceId, String requestId) {
        return traceId == null || traceId.isBlank() ? requestIdOrDefault(requestId) : traceId;
    }
}
