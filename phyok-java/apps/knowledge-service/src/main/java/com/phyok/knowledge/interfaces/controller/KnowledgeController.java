package com.phyok.knowledge.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class KnowledgeController {
    @GetMapping("/v2/knowledge/index-jobs/preview")
    public ApiResponse<Map<String, Object>> indexJobsPreview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "jobType", "semantic-chunk-and-embed",
                "sourceType", "user-upload",
                "accepted", true
        ));
    }

    @GetMapping("/internal/knowledge/chunk-summary")
    public ApiResponse<Map<String, Object>> chunkSummary(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of(
                "pendingJobs", 2,
                "indexedChunks", 128,
                "collection", "knowledge_chunks"
        ));
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "knowledge-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-knowledge" : requestId;
    }
}
