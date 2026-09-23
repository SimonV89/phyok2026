package com.phyok.auth.infrastructure.mybatis.entity;

import java.time.OffsetDateTime;

public class AdminUserQueryDO {
    private String userId;
    private String tenantId;
    private String appId;
    private String email;
    private String displayName;
    private String status;
    private String registerSource;
    private boolean deleted;
    private Long version;
    private OffsetDateTime lastLoginAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private Integer activeSessionCount;
    private OffsetDateTime latestSessionExpiresAt;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRegisterSource() {
        return registerSource;
    }

    public void setRegisterSource(String registerSource) {
        this.registerSource = registerSource;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public OffsetDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(OffsetDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getActiveSessionCount() {
        return activeSessionCount;
    }

    public void setActiveSessionCount(Integer activeSessionCount) {
        this.activeSessionCount = activeSessionCount;
    }

    public OffsetDateTime getLatestSessionExpiresAt() {
        return latestSessionExpiresAt;
    }

    public void setLatestSessionExpiresAt(OffsetDateTime latestSessionExpiresAt) {
        this.latestSessionExpiresAt = latestSessionExpiresAt;
    }
}
