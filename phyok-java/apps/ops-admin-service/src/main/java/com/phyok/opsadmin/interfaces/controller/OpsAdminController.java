package com.phyok.opsadmin.interfaces.controller;

import com.phyok.contracts.AdminDashboardOverviewView;
import com.phyok.contracts.ApiResponse;
import com.phyok.opsadmin.application.service.OpsAdminQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class OpsAdminController {
    private final OpsAdminQueryService opsAdminQueryService;

    public OpsAdminController(OpsAdminQueryService opsAdminQueryService) {
        this.opsAdminQueryService = opsAdminQueryService;
    }

    @GetMapping("/v2/admin/overview")
    public ApiResponse<AdminDashboardOverviewView> overview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), opsAdminQueryService.overview());
    }

    @GetMapping("/internal/admin/resource-summary")
    public ApiResponse<Map<String, Object>> resourceSummary(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), opsAdminQueryService.resourceSummary());
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "ops-admin-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-ops-admin" : requestId;
    }
}
