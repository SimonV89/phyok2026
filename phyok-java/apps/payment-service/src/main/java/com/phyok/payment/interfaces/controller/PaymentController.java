package com.phyok.payment.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping
public class PaymentController {
    @GetMapping("/v2/payments/orders/preview")
    public ApiResponse<Map<String, Object>> orderPreview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "orderNo", "pay_" + UUID.randomUUID(),
                "productCode", "psy-space-pro-monthly",
                "amountFen", 3990,
                "currency", "CNY"
        ));
    }

    @GetMapping("/internal/payments/reconcile-summary")
    public ApiResponse<Map<String, Object>> reconcileSummary(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "pendingOrders", 1,
                "lastReconcileStatus", "SUCCESS"
        ));
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "payment-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-payment" : requestId;
    }
}
