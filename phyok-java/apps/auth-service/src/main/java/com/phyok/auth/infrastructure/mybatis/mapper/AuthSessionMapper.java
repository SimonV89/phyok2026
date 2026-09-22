package com.phyok.auth.infrastructure.mybatis.mapper;

import com.phyok.auth.infrastructure.mybatis.entity.AuthSessionPrincipalDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserAccountDO;
import com.phyok.auth.infrastructure.mybatis.entity.UserSessionWriteDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

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
}
