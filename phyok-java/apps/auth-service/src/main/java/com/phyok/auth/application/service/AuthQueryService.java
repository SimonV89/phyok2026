package com.phyok.auth.application.service;

import com.phyok.auth.infrastructure.mybatis.entity.AuthSessionPrincipalDO;
import com.phyok.auth.infrastructure.repository.AuthSessionRepository;
import com.phyok.contracts.AuthPrincipalView;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthQueryService {
    private final AuthSessionRepository authSessionRepository;

    public AuthQueryService(AuthSessionRepository authSessionRepository) {
        this.authSessionRepository = authSessionRepository;
    }

    public AuthPrincipalView verifyToken(String sessionTokenHash) {
        AuthSessionPrincipalDO principal = authSessionRepository.findPrincipalBySessionTokenHash(sessionTokenHash);
        if (principal == null) {
            return new AuthPrincipalView("unknown", "unknown", "unknown", "unknown", List.of("ANONYMOUS"));
        }
        return new AuthPrincipalView(
                principal.getTenantId(),
                principal.getAppId(),
                principal.getUserId(),
                principal.getSessionId(),
                List.of("USER")
        );
    }
}
