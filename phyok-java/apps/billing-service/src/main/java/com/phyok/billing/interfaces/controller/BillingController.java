package com.phyok.billing.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class BillingController {
    @GetMapping("/v2/billing/overview")
    public ApiResponse<Map<String, Object>> overview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "plan", "pro",
                "monthlyTokenLimit", 2_000_000,
                "consumedTokens", 182_400,
                "remainingTokens", 1_817_600,
                "quotaState", "HEALTHY"
        ));
    }

    @GetMapping("/v2/billing/account")
    public ApiResponse<Map<String, Object>> account(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "plan", "pro",
                "monthlyTokenLimit", 2_000_000,
                "consumedTokens", 182_400,
                "remainingTokens", 1_817_600,
                "quotaState", "HEALTHY",
                "billingStatus", "ACTIVE"
        ));
    }

    @GetMapping("/internal/billing/quota")
    public ApiResponse<Map<String, Object>> quota(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "quotaState", "HEALTHY",
                "remainingTokens", 1_817_600
        ));
    }

    @PostMapping("/internal/billing/precheck")
    public ApiResponse<Map<String, Object>> precheck(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "allowed", true,
                "plan", "pro",
                "quotaState", "HEALTHY",
                "scene", body == null ? "unknown" : body.getOrDefault("scene", "unknown")
        ));
    }

    @PostMapping("/internal/billing/usage-record")
    public ApiResponse<Map<String, Object>> usageRecord(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "accepted", true,
                "recorded", true,
                "usage", body == null ? Map.of() : body
        ));
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "billing-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-billing" : requestId;
    }
}
