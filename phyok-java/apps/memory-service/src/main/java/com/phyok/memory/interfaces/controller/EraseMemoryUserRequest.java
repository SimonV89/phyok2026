package com.phyok.memory.interfaces.controller;

public record EraseMemoryUserRequest(
        String tenantId,
        String appId,
        String userId
) {
}
