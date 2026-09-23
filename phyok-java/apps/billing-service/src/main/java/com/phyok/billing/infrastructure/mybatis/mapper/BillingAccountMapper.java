package com.phyok.billing.infrastructure.mybatis.mapper;

import com.phyok.billing.infrastructure.mybatis.entity.BillingAccountDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingGrantRecordDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingUsageRecordDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface BillingAccountMapper {
    BillingAccountDO selectAccountByAppAndEmail(@Param("appId") String appId, @Param("userEmail") String userEmail);

    int insertAccount(BillingAccountDO billingAccount);

    int addPurchasedQuota(
            @Param("id") String id,
            @Param("planId") String planId,
            @Param("quota") int quota,
            @Param("orderNo") String orderNo,
            @Param("grantAt") java.time.OffsetDateTime grantAt
    );

    int insertGrantRecord(BillingGrantRecordDO grantRecord);

    int insertUsageRecord(BillingUsageRecordDO usageRecord);

    int consumeQuota(@Param("id") String id, @Param("quota") int quota);
}
