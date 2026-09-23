package com.phyok.contracts;

import java.util.List;

public record RetrievedMemoryFragmentView(
        String fragmentId,
        String title,
        String content,
        double score,
        List<String> topicTags,
        List<String> emotionTags
) {
}
