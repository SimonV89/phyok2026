package com.phyok.payment.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.PaymentOrderPageView;
import com.phyok.payment.application.service.PaymentOrderService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping
public class PaymentController {
    private final PaymentOrderService paymentOrderService;

    public PaymentController(PaymentOrderService paymentOrderService) {
        this.paymentOrderService = paymentOrderService;
    }

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

    @PostMapping("/v2/payments/alipay/create")
    public ApiResponse<Map<String, Object>> createAlipayOrder(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        String planId = body == null ? "" : String.valueOf(body.getOrDefault("planId", "")).trim();
        String scene = body == null ? "desktop" : String.valueOf(body.getOrDefault("scene", "desktop")).trim();
        try {
            return ApiResponse.ok(requestIdOrDefault(requestId), paymentOrderService.createAlipayOrder(userEmail, planId, scene));
        } catch (IllegalArgumentException exception) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "PAYMENT_PLAN_INVALID", "不支持的套餐档位。", null);
        } catch (IllegalStateException exception) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "PAYMENT_CONFIG_INVALID", exception.getMessage(), null);
        }
    }

    @GetMapping("/v2/payments/orders")
    public ApiResponse<PaymentOrderPageView> listOrders(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "appId", required = false) String appId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") Integer pageSize
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                paymentOrderService.listOrders(appId, keyword, status, pageNo, pageSize)
        );
    }

    @GetMapping("/v2/payments/orders/{orderNo}")
    public ApiResponse<Map<String, Object>> queryOrder(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @PathVariable("orderNo") String orderNo,
            @RequestParam(value = "refresh", required = false, defaultValue = "false") boolean refresh
    ) {
        try {
            return ApiResponse.ok(requestIdOrDefault(requestId), paymentOrderService.queryOrder(orderNo, refresh));
        } catch (IllegalArgumentException exception) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "PAYMENT_ORDER_NOT_FOUND", exception.getMessage(), null);
        } catch (IllegalStateException exception) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "PAYMENT_QUERY_FAILED", exception.getMessage(), null);
        }
    }

    @PostMapping(
            value = {"/v2/payments/alipay/notify", "/api/pay/alipay/notify"},
            consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE
    )
    public ResponseEntity<String> alipayNotify(@RequestParam Map<String, String> callbackParams) {
        boolean accepted;
        try {
            accepted = paymentOrderService.handleAlipayNotify(new LinkedHashMap<>(callbackParams));
        } catch (IllegalStateException exception) {
            accepted = false;
        }
        return ResponseEntity.ok(accepted ? "success" : "failure");
    }

    @GetMapping("/internal/payments/reconcile-summary")
    public ApiResponse<Map<String, Object>> reconcileSummary(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "pendingOrders", 0,
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
