package com.phyok.security;

public final class TenantContext {
    private static final ThreadLocal<PrincipalContext> HOLDER = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(PrincipalContext context) {
        HOLDER.set(context);
    }

    public static PrincipalContext get() {
        return HOLDER.get();
    }

    public static void clear() {
        HOLDER.remove();
    }

    public record PrincipalContext(
            String tenantId,
            String appId,
            String userId,
            String sessionId
    ) {
    }
}
