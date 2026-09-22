package com.phyok.memory.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.MemoryGateCheckView;
import com.phyok.contracts.MemoryDeleteResultView;
import com.phyok.contracts.MemoryBulkEraseResultView;
import com.phyok.contracts.MemoryFragmentPageView;
import com.phyok.contracts.MemoryFragmentView;
import com.phyok.contracts.MemoryRetrievalPreviewView;
import com.phyok.memory.application.service.MemoryCommandService;
import com.phyok.memory.application.service.MemoryQueryService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class MemoryController {
    private final MemoryCommandService memoryCommandService;
    private final MemoryQueryService memoryQueryService;

    public MemoryController(
            MemoryCommandService memoryCommandService,
            MemoryQueryService memoryQueryService
    ) {
        this.memoryCommandService = memoryCommandService;
        this.memoryQueryService = memoryQueryService;
    }

    @PostMapping("/v2/memories")
    public ApiResponse<MemoryFragmentView> createMemory(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @Valid @RequestBody CreateMemoryFragmentRequest request
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                memoryCommandService.createFragment(
                        requestIdOrDefault(requestId),
                        request.tenantId(),
                        request.appId(),
                        request.userId(),
                        request.timelineRoot(),
                        request.contentText(),
                        request.searchable()
                )
        );
    }

    @PutMapping("/v2/memories/{id}")
    public ApiResponse<MemoryFragmentView> updateMemory(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @PathVariable("id") String id,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId,
            @Valid @RequestBody UpdateMemoryFragmentRequest request,
            HttpServletResponse response
    ) {
        MemoryFragmentView fragment = memoryCommandService.updateFragment(
                requestIdOrDefault(requestId),
                tenantId,
                appId,
                userId,
                id,
                request.timelineRoot(),
                request.contentText(),
                request.searchable()
        );
        if (fragment == null) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return new ApiResponse<>("NOT_FOUND", "memory fragment not found", requestIdOrDefault(requestId), null);
        }
        return ApiResponse.ok(requestIdOrDefault(requestId), fragment);
    }

    @GetMapping("/v2/memories/gate-check")
    public ApiResponse<MemoryGateCheckView> gateCheck(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), memoryQueryService.gateCheck(tenantId, appId, userId));
    }

    @GetMapping("/internal/memory/retrieval-preview")
    public ApiResponse<MemoryRetrievalPreviewView> retrievalPreview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId,
            @RequestParam(value = "query", defaultValue = "最近总是担心关系会突然断掉") String query
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                memoryQueryService.retrievalPreview(tenantId, appId, userId, query)
        );
    }

    @GetMapping("/v2/memories")
    public ApiResponse<MemoryFragmentPageView> listMemories(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId,
            @RequestParam(value = "timelineRoot", required = false) String timelineRoot,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "10") Integer pageSize
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                memoryQueryService.listFragments(tenantId, appId, userId, timelineRoot, pageNo, pageSize)
        );
    }

    @DeleteMapping("/v2/memories/{id}")
    public ApiResponse<MemoryDeleteResultView> deleteMemory(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @PathVariable("id") String id,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId,
            HttpServletResponse response
    ) {
        MemoryDeleteResultView result = memoryCommandService.deleteFragment(
                requestIdOrDefault(requestId),
                tenantId,
                appId,
                userId,
                id
        );
        if (!result.deleted()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return new ApiResponse<>("NOT_FOUND", "memory fragment not found", requestIdOrDefault(requestId), result);
        }
        return ApiResponse.ok(requestIdOrDefault(requestId), result);
    }

    @PostMapping("/internal/memory/erase-user")
    public ApiResponse<MemoryBulkEraseResultView> eraseUserMemories(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestBody EraseMemoryUserRequest request
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                memoryCommandService.eraseUserFragments(
                        requestIdOrDefault(requestId),
                        request.tenantId(),
                        request.appId(),
                        request.userId()
                )
        );
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "memory-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-memory" : requestId;
    }
}
