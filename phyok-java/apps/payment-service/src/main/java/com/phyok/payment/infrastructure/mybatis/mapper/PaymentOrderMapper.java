package com.phyok.payment.infrastructure.mybatis.mapper;

import com.phyok.payment.infrastructure.mybatis.entity.PaymentNotifyLogDO;
import com.phyok.payment.infrastructure.mybatis.entity.PaymentOrderDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

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

    int countOrders(
            @Param("appId") String appId,
            @Param("keyword") String keyword,
            @Param("status") String status
    );

    List<PaymentOrderDO> selectOrdersPage(
            @Param("appId") String appId,
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("limit") int limit,
            @Param("offset") int offset
    );
}
