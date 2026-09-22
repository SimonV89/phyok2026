package com.phyok.contracts;

import java.util.List;

public record MemoryRetrievalPreviewView(
        String query,
        int topK,
        String retrievalMode,
        boolean rerankEnabled,
        String qdrantCollection,
        List<MemoryRecallHitView> hits
) {
}
