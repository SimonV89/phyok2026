package com.phyok.contracts;

import java.time.OffsetDateTime;

public record MemoryFragmentView(
        String id,
        String timelineRoot,
        String contentText,
        boolean searchable,
        OffsetDateTime createdAt
) {
}
