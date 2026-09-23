package com.phyok.auth.application.service;

import com.phyok.auth.application.config.AuthEmailProperties;
import com.phyok.auth.infrastructure.mybatis.entity.AdminUserQueryDO;
import com.phyok.auth.infrastructure.repository.AuthSessionRepository;
import com.phyok.contracts.AdminUserPageView;
import com.phyok.contracts.AdminUserView;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthAdminQueryService {
    private final AuthSessionRepository authSessionRepository;
    private final AuthEmailProperties authEmailProperties;

    public AuthAdminQueryService(AuthSessionRepository authSessionRepository, AuthEmailProperties authEmailProperties) {
        this.authSessionRepository = authSessionRepository;
        this.authEmailProperties = authEmailProperties;
    }

    public AdminUserPageView listUsers(
            String tenantId,
            String appId,
            String keyword,
            String status,
            Integer pageNo,
            Integer pageSize,
            boolean includeDeleted
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int offset = (safePageNo - 1) * safePageSize;
        String safeTenantId = defaultTenantId(tenantId);
        String safeAppId = defaultAppId(appId);
        String safeKeyword = blankToNull(keyword);
        String safeStatus = blankToNull(status);
        int total = authSessionRepository.countUsers(safeTenantId, safeAppId, safeKeyword, safeStatus, includeDeleted);
        List<AdminUserView> items = authSessionRepository.findUsersPage(
                        safeTenantId,
                        safeAppId,
                        safeKeyword,
                        safeStatus,
                        includeDeleted,
                        safePageSize,
                        offset
                ).stream()
                .map(this::toView)
                .toList();
        return new AdminUserPageView(safePageNo, safePageSize, total, items);
    }

    public AdminUserView getUserDetail(String tenantId, String appId, String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        AdminUserQueryDO user = authSessionRepository.findUserDetail(defaultTenantId(tenantId), defaultAppId(appId), userId.trim());
        return user == null ? null : toView(user);
    }

    private AdminUserView toView(AdminUserQueryDO user) {
        return new AdminUserView(
                user.getUserId(),
                user.getTenantId(),
                user.getAppId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getStatus(),
                user.getRegisterSource(),
                user.isDeleted(),
                user.getVersion() == null ? 0L : user.getVersion(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getActiveSessionCount() == null ? 0 : user.getActiveSessionCount(),
                user.getLatestSessionExpiresAt()
        );
    }

    private String defaultTenantId(String tenantId) {
        return tenantId == null || tenantId.isBlank() ? authEmailProperties.getDefaultTenantId() : tenantId.trim();
    }

    private String defaultAppId(String appId) {
        return appId == null || appId.isBlank() ? authEmailProperties.getDefaultAppId() : appId.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
