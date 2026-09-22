package com.phyok.tenant.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.TenantContextView;
import com.phyok.contracts.TenantPrivacyEraseResultView;
import com.phyok.tenant.application.service.TenantPrivacyCommandService;
import com.phyok.tenant.application.service.TenantQueryService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class TenantController {
    private final TenantQueryService tenantQueryService;
    private final TenantPrivacyCommandService tenantPrivacyCommandService;

    public TenantController(
            TenantQueryService tenantQueryService,
            TenantPrivacyCommandService tenantPrivacyCommandService
    ) {
        this.tenantQueryService = tenantQueryService;
        this.tenantPrivacyCommandService = tenantPrivacyCommandService;
    }

    @GetMapping("/internal/tenant/context")
    public ApiResponse<TenantContextView> getContext(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId
    ) {
        return ApiResponse.ok(
                requestId == null ? "req-tenant" : requestId,
                tenantQueryService.getContext(tenantId, appId)
        );
    }

    @PostMapping("/internal/tenant/privacy-erase")
    public ApiResponse<TenantPrivacyEraseResultView> privacyErase(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestBody TenantPrivacyEraseRequest request
    ) {
        return ApiResponse.ok(
                requestId == null ? "req-tenant" : requestId,
                tenantPrivacyCommandService.applyPrivacyErase(
                        request.tenantId(),
                        request.appId(),
                        request.scope()
                )
        );
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(@RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        return ApiResponse.ok(requestId == null ? "req-tenant" : requestId, Map.of("service", "tenant-service", "status", "UP"));
    }

    public record TenantPrivacyEraseRequest(
            String tenantId,
            String appId,
            String scope
    ) {
    }
}
