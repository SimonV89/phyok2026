package com.phyok.billing.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.billing.application.service.BillingAccountService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class BillingController {
    private static final List<Map<String, Object>> PLAN_ITEMS = List.of(
            createPlan("starter", "尝鲜", 500, 10, "适合先体验一段聚焦式探索。", "10 次对话额度", false),
            createPlan("standard", "标准", 1000, 30, "适合稳定使用，覆盖连续整理与复盘。", "30 次对话额度", true),
            createPlan("unlimited", "畅享", 2500, 100, "适合高频深入使用，保留更充足的探索空间。", "100 次对话额度", false)
    );
    private final BillingAccountService billingAccountService;

    public BillingController(BillingAccountService billingAccountService) {
        this.billingAccountService = billingAccountService;
    }

    @GetMapping("/v2/billing/overview")
    public ApiResponse<Map<String, Object>> overview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail
    ) {
        Map<String, Object> account = billingAccountService.buildAccountPayload(userEmail);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "plan", account.get("plan"),
                "monthlyTokenLimit", account.get("monthlyTokenLimit"),
                "consumedTokens", account.get("consumedTokens"),
                "remainingTokens", account.get("remainingTokens"),
                "quotaState", account.get("quotaState"),
                "paymentChannel", account.get("paymentChannel")
        ));
    }

    @GetMapping("/v2/billing/account")
    public ApiResponse<Map<String, Object>> account(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), billingAccountService.buildAccountPayload(userEmail));
    }

    @GetMapping("/v2/billing/plans")
    public ApiResponse<Map<String, Object>> plans(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "paymentChannel", "alipay",
                "items", PLAN_ITEMS
        ));
    }

    @GetMapping("/internal/billing/quota")
    public ApiResponse<Map<String, Object>> quota(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail
    ) {
        Map<String, Object> account = billingAccountService.buildAccountPayload(userEmail);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "quotaState", account.get("quotaState"),
                "remainingTokens", account.get("remainingTokens"),
                "plan", account.get("plan")
        ));
    }

    @PostMapping("/internal/billing/precheck")
    public ApiResponse<Map<String, Object>> precheck(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        Map<String, Object> account = billingAccountService.buildAccountPayload(userEmail);
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "allowed", true,
                "plan", account.get("plan"),
                "quotaState", account.get("quotaState"),
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

    @PostMapping("/internal/billing/grant-purchase")
    public ApiResponse<Map<String, Object>> grantPurchase(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String orderNo = String.valueOf(payload.getOrDefault("orderNo", "")).trim();
        String userEmail = String.valueOf(payload.getOrDefault("userEmail", "")).trim();
        String planId = String.valueOf(payload.getOrDefault("planId", "")).trim();
        int quota = parseInt(payload.get("quota"));
        int amountFen = parseInt(payload.get("amountFen"));
        String paymentChannel = String.valueOf(payload.getOrDefault("paymentChannel", "alipay")).trim();
        if (orderNo.isBlank() || userEmail.isBlank() || planId.isBlank() || quota <= 0) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "BILLING_GRANT_INVALID", "额度发放参数不完整。", null);
        }
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                billingAccountService.grantPurchasedQuota(orderNo, userEmail, planId, quota, amountFen, paymentChannel)
        );
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

    private static Map<String, Object> createPlan(
            String id,
            String name,
            int priceFen,
            int quota,
            String description,
            String highlight,
            boolean recommended
    ) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("name", name);
        item.put("priceFen", priceFen);
        item.put("quota", quota);
        item.put("description", description);
        item.put("highlight", highlight);
        item.put("recommended", recommended);
        return item;
    }

    private int parseInt(Object rawValue) {
        if (rawValue instanceof Number number) {
            return number.intValue();
        }
        if (rawValue == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(rawValue));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
