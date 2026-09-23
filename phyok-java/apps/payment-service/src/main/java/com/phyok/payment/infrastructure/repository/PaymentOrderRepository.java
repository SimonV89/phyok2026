package com.phyok.payment.infrastructure.repository;

import com.phyok.payment.infrastructure.mybatis.entity.PaymentNotifyLogDO;
import com.phyok.payment.infrastructure.mybatis.entity.PaymentOrderDO;
import com.phyok.payment.infrastructure.mybatis.mapper.PaymentOrderMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
public class PaymentOrderRepository {
    private final PaymentOrderMapper paymentOrderMapper;

    public PaymentOrderRepository(PaymentOrderMapper paymentOrderMapper) {
        this.paymentOrderMapper = paymentOrderMapper;
    }

    public void insertOrder(PaymentOrderDO paymentOrder) {
        paymentOrderMapper.insertOrder(paymentOrder);
    }

    public PaymentOrderDO findOrderById(String id) {
        return paymentOrderMapper.selectOrderById(id);
    }

    public void updateOrderStatus(
            String id,
            String status,
            String tradeNo,
            String buyerId,
            String notifyPayload,
            OffsetDateTime paidAt
    ) {
        paymentOrderMapper.updateOrderStatus(id, status, tradeNo, buyerId, notifyPayload, paidAt);
    }

    public boolean insertNotifyLog(PaymentNotifyLogDO notifyLog) {
        return paymentOrderMapper.insertNotifyLog(notifyLog) > 0;
    }
}
