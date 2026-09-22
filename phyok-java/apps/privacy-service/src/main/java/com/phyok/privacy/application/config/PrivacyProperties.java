package com.phyok.privacy.application.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.privacy")
public class PrivacyProperties {
    private String memoryBaseUrl = "http://memory-service:18083";
    private String authBaseUrl = "http://auth-service:18081";
    private String tenantBaseUrl = "http://tenant-service:18082";
    private boolean auditEnabled = true;
    private String auditBaseUrl = "http://audit-service:18087";

    public String getMemoryBaseUrl() {
        return memoryBaseUrl;
    }

    public void setMemoryBaseUrl(String memoryBaseUrl) {
        this.memoryBaseUrl = memoryBaseUrl;
    }

    public String getAuthBaseUrl() {
        return authBaseUrl;
    }

    public void setAuthBaseUrl(String authBaseUrl) {
        this.authBaseUrl = authBaseUrl;
    }

    public String getTenantBaseUrl() {
        return tenantBaseUrl;
    }

    public void setTenantBaseUrl(String tenantBaseUrl) {
        this.tenantBaseUrl = tenantBaseUrl;
    }

    public boolean isAuditEnabled() {
        return auditEnabled;
    }

    public void setAuditEnabled(boolean auditEnabled) {
        this.auditEnabled = auditEnabled;
    }

    public String getAuditBaseUrl() {
        return auditBaseUrl;
    }

    public void setAuditBaseUrl(String auditBaseUrl) {
        this.auditBaseUrl = auditBaseUrl;
    }
}
