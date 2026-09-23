package com.phyok.billing.application.service;

import com.phyok.billing.infrastructure.mybatis.entity.BillingAccountDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingGrantRecordDO;
import com.phyok.billing.infrastructure.repository.BillingAccountRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class BillingAccountService {
    private static final String DEFAULT_APP_ID = "app-self-explore";
    private final BillingAccountRepository billingAccountRepository;

    public BillingAccountService(BillingAccountRepository billingAccountRepository) {
        this.billingAccountRepository = billingAccountRepository;
    }

    public Map<String, Object> buildAccountPayload(String userEmail) {
        String normalizedEmail = normalizeEmail(userEmail);
        BillingAccountDO account = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, normalizedEmail);
        if (account == null) {
          return buildVirtualDefaultPayload(normalizedEmail);
        }
        return toAccountPayload(account);
    }

    public Map<String, Object> grantPurchasedQuota(
            String orderNo,
            String userEmail,
            String planId,
            int quota,
            int amountFen,
            String paymentChannel
    ) {
        String normalizedEmail = normalizeEmail(userEmail);
        BillingGrantRecordDO grantRecord = new BillingGrantRecordDO();
        grantRecord.setId("grant_" + UUID.randomUUID());
        grantRecord.setOrderNo(orderNo);
        grantRecord.setAppId(DEFAULT_APP_ID);
        grantRecord.setUserEmail(normalizedEmail);
        grantRecord.setPlanId(planId);
        grantRecord.setQuota(quota);
        grantRecord.setAmountFen(amountFen);
        grantRecord.setPaymentChannel(paymentChannel == null || paymentChannel.isBlank() ? "alipay" : paymentChannel);
        grantRecord.setStatus("GRANTED");

        boolean inserted = billingAccountRepository.insertGrantRecord(grantRecord);
        ensureAccountExists(normalizedEmail);
        BillingAccountDO account = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, normalizedEmail);
        if (account == null) {
            throw new IllegalStateException("账单账户初始化失败。");
        }

        if (inserted) {
            billingAccountRepository.addPurchasedQuota(account.getId(), planId, quota, orderNo, OffsetDateTime.now());
            account = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, normalizedEmail);
        }

        Map<String, Object> payload = new LinkedHashMap<>(toAccountPayload(account));
        payload.put("granted", inserted);
        payload.put("orderNo", orderNo);
        payload.put("grantedQuota", quota);
        return payload;
    }

    private void ensureAccountExists(String userEmail) {
        BillingAccountDO existing = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, userEmail);
        if (existing != null) {
            return;
        }
        boolean seedUser = isSeedUser(userEmail);
        BillingAccountDO account = new BillingAccountDO();
        account.setId("bill_" + UUID.randomUUID());
        account.setAppId(DEFAULT_APP_ID);
        account.setUserEmail(userEmail);
        account.setPlanId(seedUser ? "seed-gift" : "starter");
        account.setBaseQuota(seedUser ? 100 : 10);
        account.setPurchasedQuota(0);
        account.setConsumedQuota(0);
        account.setSeedUser(seedUser);
        account.setStatus(seedUser ? "SEEDED" : "ACTIVE");
        billingAccountRepository.insertAccount(account);
    }

    private Map<String, Object> buildVirtualDefaultPayload(String userEmail) {
        boolean seedUser = isSeedUser(userEmail);
        return new LinkedHashMap<>(Map.of(
                "plan", seedUser ? "seed-gift" : "starter",
                "monthlyTokenLimit", seedUser ? 100 : 10,
                "consumedTokens", 0,
                "remainingTokens", seedUser ? 100 : 10,
                "quotaState", "HEALTHY",
                "billingStatus", seedUser ? "SEEDED" : "ACTIVE",
                "paymentChannel", "alipay",
                "seedUser", seedUser,
                "recommendedPlanId", "standard"
        ));
    }

    private Map<String, Object> toAccountPayload(BillingAccountDO account) {
        int totalQuota = account.getBaseQuota() + account.getPurchasedQuota();
        int consumed = Math.max(0, account.getConsumedQuota());
        int remaining = Math.max(0, totalQuota - consumed);
        return new LinkedHashMap<>(Map.of(
                "plan", account.getPlanId(),
                "monthlyTokenLimit", totalQuota,
                "consumedTokens", consumed,
                "remainingTokens", remaining,
                "quotaState", remaining > 0 ? "HEALTHY" : "EXHAUSTED",
                "billingStatus", account.getStatus(),
                "paymentChannel", "alipay",
                "seedUser", account.isSeedUser(),
                "recommendedPlanId", "standard"
        ));
    }

    private String normalizeEmail(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return "anonymous@local";
        }
        return userEmail.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isSeedUser(String userEmail) {
        return userEmail != null && userEmail.trim().toLowerCase(Locale.ROOT).matches("^100(1\\d|[2-8]\\d|9\\d)@xx\\.com$");
    }
}
