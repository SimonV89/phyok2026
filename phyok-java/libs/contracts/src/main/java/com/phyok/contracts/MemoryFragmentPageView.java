package com.phyok.contracts;

import java.util.List;

public record MemoryFragmentPageView(
        int pageNo,
        int pageSize,
        int total,
        List<MemoryFragmentView> items
) {
}
