package com.phyok.contracts;

import java.time.OffsetDateTime;

public record PaymentOrderListItemView(
        String orderNo,
        String userEmail,
        String planId,
        String subject,
        int amountFen,
        int quota,
        String status,
        String paymentChannel,
        String paymentMode,
        String tradeNo,
        OffsetDateTime createdAt,
        OffsetDateTime expiresAt,
        OffsetDateTime paidAt
) {
}
