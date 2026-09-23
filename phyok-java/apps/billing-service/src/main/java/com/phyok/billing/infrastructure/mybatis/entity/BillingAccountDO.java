package com.phyok.billing.infrastructure.mybatis.entity;

import java.time.OffsetDateTime;

public class BillingAccountDO {
    private String id;
    private String appId;
    private String userEmail;
    private String planId;
    private int baseQuota;
    private int purchasedQuota;
    private int consumedQuota;
    private boolean seedUser;
    private String status;
    private String lastGrantOrderNo;
    private OffsetDateTime lastGrantAt;
    private Long version;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }
    public int getBaseQuota() { return baseQuota; }
    public void setBaseQuota(int baseQuota) { this.baseQuota = baseQuota; }
    public int getPurchasedQuota() { return purchasedQuota; }
    public void setPurchasedQuota(int purchasedQuota) { this.purchasedQuota = purchasedQuota; }
    public int getConsumedQuota() { return consumedQuota; }
    public void setConsumedQuota(int consumedQuota) { this.consumedQuota = consumedQuota; }
    public boolean isSeedUser() { return seedUser; }
    public void setSeedUser(boolean seedUser) { this.seedUser = seedUser; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getLastGrantOrderNo() { return lastGrantOrderNo; }
    public void setLastGrantOrderNo(String lastGrantOrderNo) { this.lastGrantOrderNo = lastGrantOrderNo; }
    public OffsetDateTime getLastGrantAt() { return lastGrantAt; }
    public void setLastGrantAt(OffsetDateTime lastGrantAt) { this.lastGrantAt = lastGrantAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
