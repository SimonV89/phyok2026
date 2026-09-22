package com.phyok.contracts;

public record MemoryRecallHitView(
        String chunkId,
        String title,
        double score,
        String timelineBucket
) {
}
