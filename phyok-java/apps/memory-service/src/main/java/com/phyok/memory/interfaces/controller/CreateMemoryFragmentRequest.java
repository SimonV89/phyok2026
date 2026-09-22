package com.phyok.memory.interfaces.controller;

import jakarta.validation.constraints.NotBlank;

public record CreateMemoryFragmentRequest(
        String tenantId,
        String appId,
        String userId,
        String timelineRoot,
        @NotBlank(message = "contentText must not be blank")
        String contentText,
        Boolean searchable
) {
}
