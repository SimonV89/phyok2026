package com.phyok.auth.infrastructure.mybatis.mapper;

import com.phyok.auth.infrastructure.mybatis.entity.AuthSessionPrincipalDO;
import com.phyok.auth.infrastructure.mybatis.entity.AdminUserQueryDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserAccountDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserSessionWriteDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AuthSessionMapper {
    AuthSessionPrincipalDO selectPrincipalBySessionTokenHash(@Param("sessionTokenHash") String sessionTokenHash);

    UserAccountDO selectUserByEmail(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("email") String email
    );

    int insertUser(UserAccountDO userAccount);

    int touchUserLastLoginAt(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );

    int revokeActiveSessions(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );

    int softDeleteUserAccount(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );

    int insertSession(UserSessionWriteDO userSession);

    int countUsers(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("includeDeleted") boolean includeDeleted
    );

    List<AdminUserQueryDO> selectUsersPage(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("includeDeleted") boolean includeDeleted,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    AdminUserQueryDO selectUserDetail(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );
}
