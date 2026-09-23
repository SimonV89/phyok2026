package com.phyok.memory.interfaces.controller;

import java.util.List;

public record RetrieveMemoryRequest(
        String query,
        Integer topK,
        Double minScore,
        List<String> timelineRoots,
        List<String> topicTags
) {
}
