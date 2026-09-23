package com.phyok.billing.infrastructure.mybatis.mapper;

import com.phyok.billing.infrastructure.mybatis.entity.BillingAccountDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingGrantRecordDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;

@Mapper
public interface BillingAccountMapper {
    BillingAccountDO selectAccountByAppAndEmail(@Param("appId") String appId, @Param("userEmail") String userEmail);

    int insertAccount(BillingAccountDO billingAccount);

    int addPurchasedQuota(
            @Param("id") String id,
            @Param("planId") String planId,
            @Param("quota") int quota,
            @Param("orderNo") String orderNo,
            @Param("grantAt") OffsetDateTime grantAt
    );

    int insertGrantRecord(BillingGrantRecordDO grantRecord);
}
