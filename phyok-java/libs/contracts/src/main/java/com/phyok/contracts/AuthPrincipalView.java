package com.phyok.contracts;

import java.util.List;

public record AuthPrincipalView(
        String tenantId,
        String appId,
        String userId,
        String sessionId,
        List<String> roles,
        String email
) {
}
