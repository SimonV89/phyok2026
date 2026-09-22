package com.phyok.privacy.interfaces.controller;

import jakarta.validation.constraints.NotBlank;

public record CreatePrivacyDeleteJobRequest(
        String tenantId,
        String appId,
        String userId,
        String scope,
        String requestedBy,
        @NotBlank(message = "reason must not be blank")
        String reason
) {
}
