package com.phyok.billing.application.service;

import com.phyok.billing.infrastructure.mybatis.entity.BillingAccountDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingGrantRecordDO;
import com.phyok.billing.infrastructure.mybatis.entity.BillingUsageRecordDO;
import com.phyok.billing.infrastructure.repository.BillingAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class BillingAccountService {
    private static final String DEFAULT_APP_ID = "app-self-explore";
    private static final int DEFAULT_LOGIN_QUOTA = 20;
    private static final int SEED_USER_QUOTA = 100;
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

    public Map<String, Object> buildPrecheckPayload(String userEmail, String scene) {
        Map<String, Object> account = buildAccountPayload(userEmail);
        int remaining = extractInt(account.get("remainingTokens"));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("allowed", remaining > 0);
        payload.put("plan", account.get("plan"));
        payload.put("quotaState", account.get("quotaState"));
        payload.put("remainingTokens", remaining);
        payload.put("scene", scene == null || scene.isBlank() ? "unknown" : scene);
        return payload;
    }

    @Transactional
    public Map<String, Object> recordSuccessfulUsage(String userEmail, String runId, String scene, int quotaCost) {
        if (runId == null || runId.isBlank()) {
            throw new IllegalArgumentException("缺少有效的 runId，无法记录本次调用。");
        }
        if (quotaCost <= 0) {
            throw new IllegalArgumentException("额度扣减次数必须大于 0。");
        }

        String normalizedEmail = normalizeEmail(userEmail);
        ensureAccountExists(normalizedEmail);
        BillingAccountDO account = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, normalizedEmail);
        if (account == null) {
            throw new IllegalStateException("账单账户初始化失败。");
        }

        BillingUsageRecordDO usageRecord = new BillingUsageRecordDO();
        usageRecord.setId("usage_" + UUID.randomUUID());
        usageRecord.setAppId(DEFAULT_APP_ID);
        usageRecord.setUserEmail(normalizedEmail);
        usageRecord.setRunId(runId.trim());
        usageRecord.setScene(scene == null || scene.isBlank() ? "chat.success" : scene.trim());
        usageRecord.setQuotaCost(quotaCost);

        boolean recorded = billingAccountRepository.insertUsageRecord(usageRecord);
        if (recorded) {
            boolean consumed = billingAccountRepository.consumeQuota(account.getId(), quotaCost);
            if (!consumed) {
                throw new IllegalStateException("BILLING_QUOTA_EXHAUSTED: 可用调用次数已用完，请先购买额度后继续。");
            }
        }

        BillingAccountDO latest = billingAccountRepository.findByAppAndEmail(DEFAULT_APP_ID, normalizedEmail);
        if (latest == null) {
            throw new IllegalStateException("额度扣减后无法重新加载账户。");
        }

        Map<String, Object> payload = new LinkedHashMap<>(toAccountPayload(latest));
        payload.put("accepted", true);
        payload.put("recorded", recorded);
        payload.put("consumed", recorded);
        payload.put("idempotent", !recorded);
        payload.put("runId", runId.trim());
        payload.put("scene", usageRecord.getScene());
        payload.put("quotaCost", quotaCost);
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
        account.setBaseQuota(seedUser ? SEED_USER_QUOTA : DEFAULT_LOGIN_QUOTA);
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
                "monthlyTokenLimit", seedUser ? SEED_USER_QUOTA : DEFAULT_LOGIN_QUOTA,
                "consumedTokens", 0,
                "remainingTokens", seedUser ? SEED_USER_QUOTA : DEFAULT_LOGIN_QUOTA,
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

    private int extractInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
