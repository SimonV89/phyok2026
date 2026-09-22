package com.phyok.contracts;

public record MemoryGateCheckView(
        int currentCount,
        int requiredCount,
        boolean passed
) {
}
