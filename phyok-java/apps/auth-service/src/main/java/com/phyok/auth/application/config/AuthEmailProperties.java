package com.phyok.auth.application.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AuthEmailProperties {
    @Value("${PHYOK_AUTH_DEFAULT_TENANT_ID:tenant-demo}")
    private String defaultTenantId;

    @Value("${PHYOK_AUTH_DEFAULT_APP_ID:app-self-explore}")
    private String defaultAppId;

    @Value("${AUTH_EMAIL_CODE_TTL_SECONDS:600}")
    private int codeTtlSeconds;

    @Value("${AUTH_EMAIL_SEND_COOLDOWN_SECONDS:60}")
    private int sendCooldownSeconds;

    @Value("${AUTH_SESSION_TTL_DAYS:30}")
    private int sessionTtlDays;

    @Value("${TENCENT_SES_SECRET_ID:}")
    private String tencentSesSecretId;

    @Value("${TENCENT_SES_SECRET_KEY:}")
    private String tencentSesSecretKey;

    @Value("${TENCENT_SES_FROM_EMAIL:}")
    private String tencentSesFromEmail;

    @Value("${TENCENT_SES_TEMPLATE_EN:}")
    private String tencentSesTemplateEn;

    @Value("${TENCENT_SES_TEMPLATE_ZH:}")
    private String tencentSesTemplateZh;

    @Value("${TENCENT_SES_REGION:ap-hongkong}")
    private String tencentSesRegion;

    @Value("${TENCENT_SES_API_ENDPOINT:ses.ap-hongkong.tencentcloudapi.com}")
    private String tencentSesApiEndpoint;

    @Value("${PHYOK_AUTH_AUDIT_ENABLED:true}")
    private boolean auditEnabled;

    @Value("${AUDIT_INTERNAL_BASE_URL:http://audit-service:18087}")
    private String auditBaseUrl;

    public String getDefaultTenantId() {
        return defaultTenantId;
    }

    public String getDefaultAppId() {
        return defaultAppId;
    }

    public int getCodeTtlSeconds() {
        return codeTtlSeconds;
    }

    public int getSendCooldownSeconds() {
        return sendCooldownSeconds;
    }

    public int getSessionTtlDays() {
        return sessionTtlDays;
    }

    public String getTencentSesSecretId() {
        return tencentSesSecretId;
    }

    public String getTencentSesSecretKey() {
        return tencentSesSecretKey;
    }

    public String getTencentSesFromEmail() {
        return tencentSesFromEmail;
    }

    public String getTencentSesTemplateEn() {
        return tencentSesTemplateEn;
    }

    public String getTencentSesTemplateZh() {
        return tencentSesTemplateZh;
    }

    public String getTencentSesRegion() {
        return tencentSesRegion;
    }

    public String getTencentSesApiEndpoint() {
        return tencentSesApiEndpoint;
    }

    public boolean isAuditEnabled() {
        return auditEnabled;
    }

    public String getAuditBaseUrl() {
        return auditBaseUrl;
    }
}
