package com.phyok.auth.application.service;

import com.phyok.auth.application.config.AuthEmailProperties;
import com.phyok.auth.infrastructure.client.AuthAuditClient;
import com.phyok.auth.infrastructure.mybatis.entity.UserAccountDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserSessionWriteDO;
import com.phyok.auth.infrastructure.repository.AuthSessionRepository;
import com.phyok.contracts.AuthEraseResultView;
import com.phyok.contracts.AuthPrincipalView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthCommandService {
    private final AuthSessionRepository authSessionRepository;
    private final AuthEmailProperties properties;
    private final TencentSesTemplateEmailService emailService;
    private final AuthAuditClient authAuditClient;
    private final SecureRandom secureRandom = new SecureRandom();
    private final ConcurrentHashMap<String, EmailCodeRecord> codeStore = new ConcurrentHashMap<>();

    public AuthCommandService(
            AuthSessionRepository authSessionRepository,
            AuthEmailProperties properties,
            TencentSesTemplateEmailService emailService,
            AuthAuditClient authAuditClient
    ) {
        this.authSessionRepository = authSessionRepository;
        this.properties = properties;
        this.emailService = emailService;
        this.authAuditClient = authAuditClient;
    }

    public Map<String, Object> sendEmailCode(String requestId, String email, String locale, String appId) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedLocale = locale == null || locale.isBlank() ? "zh-CN" : locale.trim();
        String effectiveAppId = appId == null || appId.isBlank() ? properties.getDefaultAppId() : appId.trim();
        String codeKey = codeKey(effectiveAppId, normalizedEmail);
        OffsetDateTime now = OffsetDateTime.now();
        boolean seedEmail = isSeedEmail(normalizedEmail);

        EmailCodeRecord previous = codeStore.get(codeKey);
        if (previous != null && previous.expiresAt().isAfter(now)) {
            long cooldownLeft = properties.getSendCooldownSeconds() - (now.toEpochSecond() - previous.sentAt().toEpochSecond());
            if (cooldownLeft > 0) {
                publishAuditEvent(requestId, properties.getDefaultTenantId(), effectiveAppId, "anonymous", "AUTH_EMAIL_CODE_REJECTED", normalizedEmail, Map.of(
                        "reason", "COOLDOWN",
                        "retryAfterSec", cooldownLeft
                ));
                return Map.of(
                        "accepted", false,
                        "retryAfterSec", cooldownLeft,
                        "expiresInSec", Math.max(1, previous.expiresAt().toEpochSecond() - now.toEpochSecond())
                );
            }
        }

        String code = seedEmail ? properties.getSeedEmailCode() : generateCode();
        OffsetDateTime expiresAt = now.plusSeconds(properties.getCodeTtlSeconds());
        codeStore.put(codeKey, new EmailCodeRecord(code, expiresAt, now));
        if (!seedEmail) {
            emailService.sendLoginCode(normalizedEmail, code, normalizedLocale);
        }
        publishAuditEvent(requestId, properties.getDefaultTenantId(), effectiveAppId, "anonymous", "AUTH_EMAIL_CODE_SENT", normalizedEmail, Map.of(
                "locale", normalizedLocale,
                "expiresInSec", properties.getCodeTtlSeconds(),
                "seedUser", seedEmail
        ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accepted", true);
        result.put("ticket", "code_" + UUID.randomUUID());
        result.put("retryAfterSec", properties.getSendCooldownSeconds());
        result.put("expiresInSec", properties.getCodeTtlSeconds());
        if (seedEmail && properties.isDebugReturnCode()) {
            result.put("debugCode", properties.getSeedEmailCode());
        }
        return result;
    }

    @Transactional
    public Map<String, Object> verifyEmailCode(
            String requestId,
            String email,
            String code,
            String appId,
            String deviceId,
            String clientVersion
    ) {
        String normalizedEmail = normalizeEmail(email);
        String effectiveAppId = appId == null || appId.isBlank() ? properties.getDefaultAppId() : appId.trim();
        String effectiveDeviceId = deviceId == null || deviceId.isBlank() ? "web-device" : deviceId.trim();
        String effectiveClientVersion = clientVersion == null || clientVersion.isBlank() ? "chat-web" : clientVersion.trim();
        EmailCodeRecord current = codeStore.get(codeKey(effectiveAppId, normalizedEmail));
        OffsetDateTime now = OffsetDateTime.now();
        boolean seedEmail = isSeedEmail(normalizedEmail);

        boolean codeMatched = current != null && current.expiresAt().isAfter(now) && current.code().equals(code.trim());
        if (!codeMatched && !(seedEmail && properties.getSeedEmailCode().equals(code.trim()))) {
            publishAuditEvent(requestId, properties.getDefaultTenantId(), effectiveAppId, "anonymous", "AUTH_LOGIN_FAILED", normalizedEmail, Map.of(
                    "reason", "INVALID_EMAIL_CODE"
            ));
            throw new IllegalArgumentException("验证码无效或已过期。");
        }

        UserAccountDO user = authSessionRepository.findUserByEmail(
                properties.getDefaultTenantId(),
                effectiveAppId,
                normalizedEmail
        );
        boolean newUser = false;
        if (user == null) {
            user = new UserAccountDO();
            user.setId("user_" + UUID.randomUUID());
            user.setTenantId(properties.getDefaultTenantId());
            user.setAppId(effectiveAppId);
            user.setEmail(normalizedEmail);
            user.setDisplayName(defaultDisplayName(normalizedEmail));
            user.setStatus("ACTIVE");
            user.setRegisterSource("EMAIL");
            authSessionRepository.insertUser(user);
            newUser = true;
        }

        authSessionRepository.touchUserLastLoginAt(user.getTenantId(), user.getAppId(), user.getId());
        int revokedSessionCount = authSessionRepository.revokeActiveSessions(user.getTenantId(), user.getAppId(), user.getId());

        String sessionToken = "sess_" + UUID.randomUUID();
        String refreshToken = "refresh_" + UUID.randomUUID();
        OffsetDateTime expiredAt = now.plusDays(properties.getSessionTtlDays());

        UserSessionWriteDO session = new UserSessionWriteDO();
        session.setId("sess_" + UUID.randomUUID());
        session.setTenantId(user.getTenantId());
        session.setAppId(user.getAppId());
        session.setUserId(user.getId());
        session.setSessionTokenHash(sessionToken);
        session.setRefreshTokenHash(refreshToken);
        session.setDeviceId(effectiveDeviceId);
        session.setClientVersion(effectiveClientVersion);
        session.setExpiredAt(expiredAt);
        authSessionRepository.insertSession(session);

        codeStore.remove(codeKey(effectiveAppId, normalizedEmail));
        publishAuditEvent(requestId, user.getTenantId(), user.getAppId(), user.getId(), "AUTH_SESSION_CREATED", normalizedEmail, Map.of(
                "sessionId", session.getId(),
                "revokedSessionCount", revokedSessionCount,
                "newUser", newUser
        ));
        publishAuditEvent(requestId, user.getTenantId(), user.getAppId(), user.getId(), "AUTH_LOGIN_SUCCEEDED", normalizedEmail, Map.of(
                "sessionId", session.getId(),
                "newUser", newUser,
                "deviceId", effectiveDeviceId,
                "clientVersion", effectiveClientVersion
        ));

        AuthPrincipalView principalView = new AuthPrincipalView(
                user.getTenantId(),
                user.getAppId(),
                user.getId(),
                session.getId(),
                List.of("USER"),
                normalizedEmail
        );

        return Map.of(
                "sessionToken", sessionToken,
                "refreshToken", refreshToken,
                "expiresAt", expiredAt.toString(),
                "principal", principalView,
                "newUser", newUser
        );
    }

    @Transactional
    public AuthEraseResultView eraseUserAuthData(String requestId, String tenantId, String appId, String userId) {
        String safeTenantId = tenantId == null || tenantId.isBlank() ? properties.getDefaultTenantId() : tenantId.trim();
        String safeAppId = appId == null || appId.isBlank() ? properties.getDefaultAppId() : appId.trim();
        String safeUserId = userId == null || userId.isBlank() ? "user-demo" : userId.trim();
        int revokedSessionCount = authSessionRepository.revokeActiveSessions(safeTenantId, safeAppId, safeUserId);
        boolean accountErased = authSessionRepository.softDeleteUserAccount(safeTenantId, safeAppId, safeUserId) > 0;
        publishAuditEvent(requestId, safeTenantId, safeAppId, safeUserId, "AUTH_USER_ERASED", null, Map.of(
                "revokedSessionCount", revokedSessionCount,
                "accountErased", accountErased
        ));
        return new AuthEraseResultView(safeTenantId, safeAppId, safeUserId, revokedSessionCount, accountErased);
    }

    private String defaultDisplayName(String email) {
        int index = email.indexOf("@");
        String localPart = index > 0 ? email.substring(0, index) : email;
        return localPart.toUpperCase(Locale.ROOT);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String codeKey(String appId, String email) {
        return appId + "|" + email;
    }

    private boolean isSeedEmail(String email) {
        if (!properties.isDevSeedLoginEnabled()) {
            return false;
        }
        String pattern = properties.getSeedEmailPattern();
        String code = properties.getSeedEmailCode();
        return email != null
                && pattern != null
                && !pattern.isBlank()
                && code != null
                && !code.isBlank()
                && email.matches(pattern);
    }

    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private void publishAuditEvent(
            String requestId,
            String tenantId,
            String appId,
            String userId,
            String eventType,
            String email,
            Map<String, Object> extraPayload
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", tenantId == null || tenantId.isBlank() ? properties.getDefaultTenantId() : tenantId);
        payload.put("appId", appId == null || appId.isBlank() ? properties.getDefaultAppId() : appId);
        payload.put("userId", userId == null || userId.isBlank() ? "anonymous" : userId);
        payload.put("eventType", eventType);
        payload.put("sourceService", "auth-service");
        payload.put("entityType", "AUTH_SESSION");
        payload.put("entityId", userId == null || userId.isBlank() ? "anonymous" : userId);
        if (email != null && !email.isBlank()) {
            payload.put("email", email);
        }
        payload.putAll(extraPayload);
        String safeRequestId = requestId == null || requestId.isBlank() ? "req-auth" : requestId.trim();
        authAuditClient.publishEvent(safeRequestId, safeRequestId + ":" + eventType + ":" + payload.get("entityId"), payload);
    }

    private record EmailCodeRecord(String code, OffsetDateTime expiresAt, OffsetDateTime sentAt) {
    }
}
