package com.phyok.contracts;

import java.time.OffsetDateTime;
import java.util.List;

public record MemoryFragmentView(
        String id,
        String timelineRoot,
        String contentText,
        boolean searchable,
        String fragmentType,
        String visibility,
        String timeBucket,
        List<String> topicTags,
        List<String> emotionTags,
        int chunkSeq,
        double chunkConfidence,
        String chunkStrategy,
        OffsetDateTime createdAt
) {
}
