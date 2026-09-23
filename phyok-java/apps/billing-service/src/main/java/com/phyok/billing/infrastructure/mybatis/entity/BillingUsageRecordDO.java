package com.phyok.billing.infrastructure.mybatis.entity;

import java.time.OffsetDateTime;

public class BillingUsageRecordDO {
    private String id;
    private String appId;
    private String userEmail;
    private String runId;
    private String scene;
    private int quotaCost;
    private OffsetDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }
    public String getScene() { return scene; }
    public void setScene(String scene) { this.scene = scene; }
    public int getQuotaCost() { return quotaCost; }
    public void setQuotaCost(int quotaCost) { this.quotaCost = quotaCost; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
