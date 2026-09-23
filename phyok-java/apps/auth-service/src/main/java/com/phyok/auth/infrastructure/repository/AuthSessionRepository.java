package com.phyok.auth.infrastructure.repository;

import com.phyok.auth.infrastructure.mybatis.entity.AuthSessionPrincipalDO;
import com.phyok.auth.infrastructure.mybatis.entity.AdminUserQueryDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserAccountDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserSessionWriteDO;
import com.phyok.auth.infrastructure.mybatis.mapper.AuthSessionMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class AuthSessionRepository {
    private final AuthSessionMapper authSessionMapper;

    public AuthSessionRepository(AuthSessionMapper authSessionMapper) {
        this.authSessionMapper = authSessionMapper;
    }

    public AuthSessionPrincipalDO findPrincipalBySessionTokenHash(String sessionTokenHash) {
        return authSessionMapper.selectPrincipalBySessionTokenHash(sessionTokenHash);
    }

    public UserAccountDO findUserByEmail(String tenantId, String appId, String email) {
        return authSessionMapper.selectUserByEmail(tenantId, appId, email);
    }

    public void insertUser(UserAccountDO userAccount) {
        authSessionMapper.insertUser(userAccount);
    }

    public void touchUserLastLoginAt(String tenantId, String appId, String userId) {
        authSessionMapper.touchUserLastLoginAt(tenantId, appId, userId);
    }

    public int revokeActiveSessions(String tenantId, String appId, String userId) {
        return authSessionMapper.revokeActiveSessions(tenantId, appId, userId);
    }

    public int softDeleteUserAccount(String tenantId, String appId, String userId) {
        return authSessionMapper.softDeleteUserAccount(tenantId, appId, userId);
    }

    public void insertSession(UserSessionWriteDO userSession) {
        authSessionMapper.insertSession(userSession);
    }

    public int countUsers(String tenantId, String appId, String keyword, String status, boolean includeDeleted) {
        return authSessionMapper.countUsers(tenantId, appId, keyword, status, includeDeleted);
    }

    public List<AdminUserQueryDO> findUsersPage(
            String tenantId,
            String appId,
            String keyword,
            String status,
            boolean includeDeleted,
            int limit,
            int offset
    ) {
        return authSessionMapper.selectUsersPage(tenantId, appId, keyword, status, includeDeleted, limit, offset);
    }

    public AdminUserQueryDO findUserDetail(String tenantId, String appId, String userId) {
        return authSessionMapper.selectUserDetail(tenantId, appId, userId);
    }
}
