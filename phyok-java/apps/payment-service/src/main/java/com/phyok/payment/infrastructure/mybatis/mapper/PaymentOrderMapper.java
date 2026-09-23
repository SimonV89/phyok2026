package com.phyok.payment.infrastructure.mybatis.mapper;

import com.phyok.payment.infrastructure.mybatis.entity.PaymentNotifyLogDO;
import com.phyok.payment.infrastructure.mybatis.entity.PaymentOrderDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PaymentOrderMapper {
    int insertOrder(PaymentOrderDO paymentOrder);

    PaymentOrderDO selectOrderById(@Param("id") String id);

    int updateOrderStatus(
            @Param("id") String id,
            @Param("status") String status,
            @Param("tradeNo") String tradeNo,
            @Param("buyerId") String buyerId,
            @Param("notifyPayload") String notifyPayload,
            @Param("paidAt") java.time.OffsetDateTime paidAt
    );

    int insertNotifyLog(PaymentNotifyLogDO notifyLog);
}
