package com.phyok.billing.infrastructure.repository;

import com.phyok.billing.infrastructure.mybatis.entity.BillingAccountDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingGrantRecordDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingUsageRecordDO;
import com.phyok.billing.infrastructure.mybatis.mapper.BillingAccountMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
public class BillingAccountRepository {
    private final BillingAccountMapper billingAccountMapper;

    public BillingAccountRepository(BillingAccountMapper billingAccountMapper) {
        this.billingAccountMapper = billingAccountMapper;
    }

    public BillingAccountDO findByAppAndEmail(String appId, String userEmail) {
        return billingAccountMapper.selectAccountByAppAndEmail(appId, userEmail);
    }

    public void insertAccount(BillingAccountDO account) {
        billingAccountMapper.insertAccount(account);
    }

    public void addPurchasedQuota(String id, String planId, int quota, String orderNo, OffsetDateTime grantAt) {
        billingAccountMapper.addPurchasedQuota(id, planId, quota, orderNo, grantAt);
    }

    public boolean insertGrantRecord(BillingGrantRecordDO grantRecord) {
        return billingAccountMapper.insertGrantRecord(grantRecord) > 0;
    }

    public boolean insertUsageRecord(BillingUsageRecordDO usageRecord) {
        return billingAccountMapper.insertUsageRecord(usageRecord) > 0;
    }

    public boolean consumeQuota(String id, int quota) {
        return billingAccountMapper.consumeQuota(id, quota) > 0;
    }
}
