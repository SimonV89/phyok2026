package com.phyok.contracts;

import java.time.OffsetDateTime;
import java.util.List;

public record MemoryStarMapView(
        String view,
        int limit,
        int totalMemories,
        List<Node> nodes,
        List<Link> links
) {
    public record Node(
            String id,
            String type,
            String timelineRoot,
            String label,
            String contentText,
            Double score,
            String sourceType,
            String conversationId,
            List<String> tags,
            OffsetDateTime createdAt
    ) {
    }

    public record Link(
            String source,
            String target,
            String type,
            Double score
    ) {
    }
}
