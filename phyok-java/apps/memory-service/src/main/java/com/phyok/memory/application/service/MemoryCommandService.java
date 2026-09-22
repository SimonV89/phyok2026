package com.phyok.memory.application.service;

import com.phyok.contracts.MemoryDeleteResultView;
import com.phyok.contracts.MemoryBulkEraseResultView;
import com.phyok.contracts.MemoryFragmentView;
import com.phyok.memory.infrastructure.client.MemoryAuditClient;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.repository.MemoryFragmentRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MemoryCommandService {
    private static final Set<String> TIMELINE_ROOTS = Set.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private final MemoryFragmentRepository memoryFragmentRepository;
    private final MemoryAuditClient memoryAuditClient;

    public MemoryCommandService(
            MemoryFragmentRepository memoryFragmentRepository,
            MemoryAuditClient memoryAuditClient
    ) {
        this.memoryFragmentRepository = memoryFragmentRepository;
        this.memoryAuditClient = memoryAuditClient;
    }

    public MemoryFragmentView createFragment(
            String requestId,
            String tenantId,
            String appId,
            String userId,
            String timelineRoot,
            String contentText,
            Boolean searchable
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        MemoryFragmentDO memoryFragment = new MemoryFragmentDO();
        memoryFragment.setId(generateId());
        memoryFragment.setTenantId(defaultIfBlank(tenantId, "tenant-demo"));
        memoryFragment.setAppId(defaultIfBlank(appId, "app-self-explore"));
        memoryFragment.setUserId(defaultIfBlank(userId, "user-demo"));
        memoryFragment.setTimelineRoot(normalizeTimelineRoot(timelineRoot));
        memoryFragment.setContentText(normalizeContentText(contentText));
        memoryFragment.setSearchable(searchable == null || searchable);
        memoryFragment.setDeleted(false);
        memoryFragment.setCreatedAt(now);
        memoryFragmentRepository.save(memoryFragment);
        publishAuditEvent(requestId, "MEMORY_CREATED", memoryFragment, Map.of(
                "action", "create",
                "timelineRoot", memoryFragment.getTimelineRoot(),
                "searchable", memoryFragment.isSearchable()
        ));
        return toView(memoryFragment);
    }

    public MemoryFragmentView updateFragment(
            String requestId,
            String tenantId,
            String appId,
            String userId,
            String id,
            String timelineRoot,
            String contentText,
            Boolean searchable
    ) {
        MemoryFragmentDO memoryFragment = memoryFragmentRepository.findById(
                        defaultIfBlank(tenantId, "tenant-demo"),
                        defaultIfBlank(appId, "app-self-explore"),
                        defaultIfBlank(userId, "user-demo"),
                        id
                )
                .orElse(null);
        if (memoryFragment == null) {
            return null;
        }
        if (timelineRoot != null && !timelineRoot.isBlank()) {
            memoryFragment.setTimelineRoot(normalizeTimelineRoot(timelineRoot));
        }
        memoryFragment.setContentText(normalizeContentText(contentText));
        if (searchable != null) {
            memoryFragment.setSearchable(searchable);
        }
        memoryFragmentRepository.update(memoryFragment);
        publishAuditEvent(requestId, "MEMORY_UPDATED", memoryFragment, Map.of(
                "action", "update",
                "timelineRoot", memoryFragment.getTimelineRoot(),
                "searchable", memoryFragment.isSearchable()
        ));
        return toView(memoryFragment);
    }

    public MemoryDeleteResultView deleteFragment(String requestId, String tenantId, String appId, String userId, String id) {
        MemoryFragmentDO memoryFragment = memoryFragmentRepository.findById(
                        defaultIfBlank(tenantId, "tenant-demo"),
                        defaultIfBlank(appId, "app-self-explore"),
                        defaultIfBlank(userId, "user-demo"),
                        id
                )
                .orElse(null);
        int affected = memoryFragmentRepository.softDelete(
                defaultIfBlank(tenantId, "tenant-demo"),
                defaultIfBlank(appId, "app-self-explore"),
                defaultIfBlank(userId, "user-demo"),
                id
        );
        if (affected > 0 && memoryFragment != null) {
            publishAuditEvent(requestId, "MEMORY_DELETED", memoryFragment, Map.of(
                    "action", "delete",
                    "timelineRoot", memoryFragment.getTimelineRoot()
            ));
        }
        return new MemoryDeleteResultView(id, affected > 0);
    }

    public MemoryBulkEraseResultView eraseUserFragments(String requestId, String tenantId, String appId, String userId) {
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeUserId = defaultIfBlank(userId, "user-demo");
        int affectedCount = memoryFragmentRepository.softDeleteAllByUser(safeTenantId, safeAppId, safeUserId);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", safeTenantId);
        payload.put("appId", safeAppId);
        payload.put("userId", safeUserId);
        payload.put("eventType", "MEMORY_BULK_ERASED");
        payload.put("sourceService", "memory-service");
        payload.put("entityType", "MEMORY_FRAGMENT");
        payload.put("entityId", safeUserId);
        payload.put("action", "bulk-erase");
        payload.put("affectedCount", affectedCount);
        String safeRequestId = defaultIfBlank(requestId, "req-memory");
        memoryAuditClient.publishEvent(safeRequestId, safeRequestId + ":bulk-erase:" + safeUserId, payload);
        return new MemoryBulkEraseResultView(safeTenantId, safeAppId, safeUserId, affectedCount);
    }

    private MemoryFragmentView toView(MemoryFragmentDO memoryFragment) {
        return new MemoryFragmentView(
                memoryFragment.getId(),
                memoryFragment.getTimelineRoot(),
                memoryFragment.getContentText(),
                memoryFragment.isSearchable(),
                memoryFragment.getCreatedAt()
        );
    }

    private String generateId() {
        return "mem_" + UUID.randomUUID().toString().replace("-", "");
    }

    private String defaultIfBlank(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private String normalizeContentText(String contentText) {
        return contentText == null || contentText.isBlank() ? "待补充记忆内容" : contentText.trim();
    }

    private String normalizeTimelineRoot(String timelineRoot) {
        String normalized = timelineRoot == null || timelineRoot.isBlank()
                ? "TODAY"
                : timelineRoot.trim().toUpperCase(Locale.ROOT);
        return TIMELINE_ROOTS.contains(normalized) ? normalized : "TODAY";
    }

    private void publishAuditEvent(
            String requestId,
            String eventType,
            MemoryFragmentDO memoryFragment,
            Map<String, Object> extraPayload
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", memoryFragment.getTenantId());
        payload.put("appId", memoryFragment.getAppId());
        payload.put("userId", memoryFragment.getUserId());
        payload.put("eventType", eventType);
        payload.put("sourceService", "memory-service");
        payload.put("entityType", "MEMORY_FRAGMENT");
        payload.put("entityId", memoryFragment.getId());
        payload.put("contentPreview", buildContentPreview(memoryFragment.getContentText()));
        payload.putAll(extraPayload);
        String safeRequestId = defaultIfBlank(requestId, "req-memory");
        memoryAuditClient.publishEvent(safeRequestId, safeRequestId + ":" + memoryFragment.getId(), payload);
    }

    private String buildContentPreview(String contentText) {
        String normalized = normalizeContentText(contentText).replace('\n', ' ');
        return normalized.length() <= 48 ? normalized : normalized.substring(0, 48) + "...";
    }
}
