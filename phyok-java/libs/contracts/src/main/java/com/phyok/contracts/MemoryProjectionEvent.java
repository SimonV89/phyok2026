package com.phyok.contracts;

import java.util.List;

public record MemoryProjectionEvent(
        String eventType,
        String tenantId,
        String appId,
        String userId,
        String fragmentId,
        String timelineRoot,
        String fragmentType,
        String visibility,
        String timeBucket,
        List<String> topicTags,
        List<String> emotionTags,
        boolean searchable,
        boolean deleted,
        String contentText,
        Integer chunkSeq,
        Double chunkConfidence,
        String chunkStrategy,
        Long createdAt
) {
}
