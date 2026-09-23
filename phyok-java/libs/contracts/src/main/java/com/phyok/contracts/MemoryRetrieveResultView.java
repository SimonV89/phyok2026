package com.phyok.contracts;

import java.util.List;

public record MemoryRetrieveResultView(
        String query,
        int topK,
        double minScore,
        List<RetrievedMemoryFragmentView> items
) {
}
