package com.phyok.payment.application.service;

import com.phyok.payment.infrastructure.mybatis.entity.PaymentNotifyLogDO;
import com.phyok.payment.infrastructure.mybatis.entity.PaymentOrderDO;
import com.phyok.payment.infrastructure.repository.PaymentOrderRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PaymentOrderService {
    private static final String DEFAULT_APP_ID = "app-self-explore";
    private static final Map<String, PlanDefinition> PLAN_DEFINITIONS = Map.of(
            "starter", new PlanDefinition("starter", "尝鲜", 500, 10),
            "standard", new PlanDefinition("standard", "标准", 1000, 30),
            "unlimited", new PlanDefinition("unlimited", "畅享", 2500, 100)
    );

    private final AlipaySignatureService alipaySignatureService;
    private final AlipayGatewayClient alipayGatewayClient;
    private final BillingGrantClient billingGrantClient;
    private final PaymentOrderRepository paymentOrderRepository;

    public PaymentOrderService(
            AlipaySignatureService alipaySignatureService,
            AlipayGatewayClient alipayGatewayClient,
            BillingGrantClient billingGrantClient,
            PaymentOrderRepository paymentOrderRepository
    ) {
        this.alipaySignatureService = alipaySignatureService;
        this.alipayGatewayClient = alipayGatewayClient;
        this.billingGrantClient = billingGrantClient;
        this.paymentOrderRepository = paymentOrderRepository;
    }

    public Map<String, Object> createAlipayOrder(String userEmail, String planId) {
        PlanDefinition planDefinition = PLAN_DEFINITIONS.get(planId);
        if (planDefinition == null) {
            throw new IllegalArgumentException("不支持的套餐档位。");
        }

        String orderNo = "pay_" + UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusMinutes(15);
        PaymentOrderRecord draftRecord = new PaymentOrderRecord(
                orderNo,
                DEFAULT_APP_ID,
                planDefinition.id(),
                planDefinition.name() + " · 心理学空间额度购买",
                planDefinition.priceFen(),
                planDefinition.quota(),
                normalizeEmail(userEmail),
                "CREATED",
                null,
                null,
                now,
                expiresAt,
                null,
                null,
                null,
                null
        );
        String payUrl = alipaySignatureService.buildPagePayUrl(draftRecord);
        PaymentOrderRecord finalized = draftRecord.withCheckout(payUrl, payUrl);
        paymentOrderRepository.insertOrder(toPaymentOrderDO(finalized));
        return toOrderPayload(finalized);
    }

    public Map<String, Object> queryOrder(String orderNo, boolean refreshStatus) {
        PaymentOrderDO order = requireOrder(orderNo);
        if (refreshStatus && shouldRefresh(order.getStatus())) {
            order = refreshOrderStatus(order);
        }
        return toOrderPayload(toRecord(order));
    }

    public boolean handleAlipayNotify(Map<String, String> callbackParams) {
        if (!alipaySignatureService.verifyCallback(callbackParams)) {
            return false;
        }

        String orderNo = callbackParams.get("out_trade_no");
        if (orderNo == null || orderNo.isBlank()) {
            return false;
        }

        PaymentOrderDO current = paymentOrderRepository.findOrderById(orderNo);
        if (current == null) {
            return false;
        }

        String payloadText = canonicalPayload(callbackParams);
        PaymentNotifyLogDO notifyLog = new PaymentNotifyLogDO();
        notifyLog.setId("ntf_" + UUID.randomUUID());
        notifyLog.setOrderId(orderNo);
        notifyLog.setNotifyId(callbackParams.get("notify_id"));
        notifyLog.setTradeNo(callbackParams.get("trade_no"));
        notifyLog.setTradeStatus(callbackParams.get("trade_status"));
        notifyLog.setRequestBodyHash(sha256Hex(payloadText));
        notifyLog.setProcessed(false);
        notifyLog.setPayloadJson(payloadText);

        boolean inserted = paymentOrderRepository.insertNotifyLog(notifyLog);
        if (!inserted) {
            return true;
        }

        verifyAmountMatches(current, callbackParams.get("total_amount"));
        paymentOrderRepository.updateOrderStatus(
                orderNo,
                normalizeStatus(callbackParams.getOrDefault("trade_status", "UNKNOWN")),
                callbackParams.get("trade_no"),
                callbackParams.get("buyer_id"),
                payloadText,
                isPaidStatus(callbackParams.get("trade_status")) ? OffsetDateTime.now() : null
        );
        maybeGrantQuota(orderNo);
        return true;
    }

    private PaymentOrderDO refreshOrderStatus(PaymentOrderDO order) {
        Optional<AlipayGatewayClient.TradeQueryResult> remote = alipayGatewayClient.queryTrade(order.getId());
        if (remote.isEmpty()) {
            return order;
        }
        AlipayGatewayClient.TradeQueryResult queryResult = remote.get();
        verifyAmountMatches(order, queryResult.totalAmount());
        String nextStatus = normalizeStatus(queryResult.tradeStatus());
        OffsetDateTime paidAt = isPaidStatus(queryResult.tradeStatus()) ? OffsetDateTime.now() : null;
        paymentOrderRepository.updateOrderStatus(
                order.getId(),
                nextStatus,
                queryResult.tradeNo(),
                queryResult.buyerId(),
                "trade.query",
                paidAt
        );
        PaymentOrderDO latest = requireOrder(order.getId());
        maybeGrantQuota(order.getId());
        return requireOrder(latest.getId());
    }

    private boolean shouldRefresh(String status) {
        return "CREATED".equals(status) || "PENDING".equals(status);
    }

    private boolean isPaidStatus(String tradeStatus) {
        return "TRADE_SUCCESS".equals(tradeStatus) || "TRADE_FINISHED".equals(tradeStatus) || "PAID".equals(tradeStatus);
    }

    private void verifyAmountMatches(PaymentOrderDO order, String totalAmount) {
        if (totalAmount == null || totalAmount.isBlank()) {
            return;
        }
        String expected = String.format(Locale.ROOT, "%.2f", order.getAmountFen() / 100.0);
        if (!expected.equals(totalAmount)) {
            throw new IllegalStateException("支付宝回调金额与订单金额不一致。");
        }
    }

    private String normalizeStatus(String tradeStatus) {
        return switch (tradeStatus) {
            case "TRADE_SUCCESS", "TRADE_FINISHED" -> "PAID";
            case "WAIT_BUYER_PAY", "CREATED" -> "PENDING";
            case "TRADE_CLOSED" -> "CLOSED";
            default -> tradeStatus;
        };
    }

    private PaymentOrderDO requireOrder(String orderNo) {
        PaymentOrderDO order = paymentOrderRepository.findOrderById(orderNo);
        if (order == null) {
            throw new IllegalArgumentException("订单不存在。");
        }
        return order;
    }

    private void maybeGrantQuota(String orderNo) {
        PaymentOrderDO latest = requireOrder(orderNo);
        if (!"PAID".equals(latest.getStatus())) {
            return;
        }
        billingGrantClient.grantPaidOrder(toRecord(latest));
    }

    private PaymentOrderRecord toRecord(PaymentOrderDO order) {
        return new PaymentOrderRecord(
                order.getId(),
                order.getAppId(),
                order.getPlanId(),
                order.getSubject(),
                order.getAmountFen(),
                order.getQuota(),
                order.getUserEmail(),
                order.getStatus(),
                order.getPayUrl(),
                order.getQrCodeUrl(),
                order.getCreatedAt(),
                order.getExpiresAt(),
                order.getTradeNo(),
                order.getPaidAt(),
                order.getBuyerId(),
                order.getNotifyPayload()
        );
    }

    private PaymentOrderDO toPaymentOrderDO(PaymentOrderRecord record) {
        PaymentOrderDO order = new PaymentOrderDO();
        order.setId(record.orderNo());
        order.setAppId(record.appId());
        order.setPlanId(record.planId());
        order.setSubject(record.subject());
        order.setAmountFen(record.amountFen());
        order.setQuota(record.quota());
        order.setUserEmail(record.userEmail());
        order.setStatus(record.status());
        order.setPayUrl(record.payUrl());
        order.setQrCodeUrl(record.qrCodeUrl());
        order.setTradeNo(record.tradeNo());
        order.setBuyerId(record.buyerId());
        order.setNotifyPayload(record.notifyPayload());
        order.setExpiresAt(record.expiresAt());
        order.setPaidAt(record.paidAt());
        return order;
    }

    private Map<String, Object> toOrderPayload(PaymentOrderRecord order) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderNo", order.orderNo());
        payload.put("planId", order.planId());
        payload.put("amountFen", order.amountFen());
        payload.put("quota", order.quota());
        payload.put("paymentChannel", "alipay");
        payload.put("status", order.status());
        payload.put("payUrl", order.payUrl());
        payload.put("qrCodeUrl", order.qrCodeUrl());
        payload.put("qrCodeContent", order.qrCodeUrl());
        payload.put("expiresAt", order.expiresAt().toString());
        payload.put("buyerEmail", order.userEmail());
        if (order.tradeNo() != null) {
            payload.put("tradeNo", order.tradeNo());
        }
        if (order.paidAt() != null) {
            payload.put("paidAt", order.paidAt().toString());
        }
        return payload;
    }

    private String canonicalPayload(Map<String, String> callbackParams) {
        return callbackParams.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&"));
    }

    private String sha256Hex(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash notify payload.", exception);
        }
    }

    private String normalizeEmail(String userEmail) {
        return userEmail == null || userEmail.isBlank() ? "anonymous@local" : userEmail.trim().toLowerCase(Locale.ROOT);
    }

    private record PlanDefinition(String id, String name, int priceFen, int quota) {
    }

    public record PaymentOrderRecord(
            String orderNo,
            String appId,
            String planId,
            String subject,
            int amountFen,
            int quota,
            String userEmail,
            String status,
            String payUrl,
            String qrCodeUrl,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt,
            String tradeNo,
            OffsetDateTime paidAt,
            String buyerId,
            String notifyPayload
    ) {
        public PaymentOrderRecord withCheckout(String nextPayUrl, String nextQrCodeUrl) {
            return new PaymentOrderRecord(
                    orderNo,
                    appId,
                    planId,
                    subject,
                    amountFen,
                    quota,
                    userEmail,
                    status,
                    nextPayUrl,
                    nextQrCodeUrl,
                    createdAt,
                    expiresAt,
                    tradeNo,
                    paidAt,
                    buyerId,
                    notifyPayload
            );
        }
    }
}
