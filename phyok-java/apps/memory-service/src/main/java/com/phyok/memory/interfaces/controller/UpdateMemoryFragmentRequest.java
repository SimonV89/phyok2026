package com.phyok.memory.interfaces.controller;

import jakarta.validation.constraints.NotBlank;

public record UpdateMemoryFragmentRequest(
        String timelineRoot,
        @NotBlank(message = "contentText must not be blank")
        String contentText,
        Boolean searchable
) {
}
