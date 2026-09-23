package com.phyok.memory.application.service;

import com.phyok.contracts.MemoryDeleteResultView;
import com.phyok.contracts.MemoryBulkEraseResultView;
import com.phyok.contracts.MemoryFragmentView;
import com.phyok.memory.infrastructure.client.MemoryAuditClient;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.repository.MemoryFragmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MemoryCommandService {
    private static final Set<String> TIMELINE_ROOTS = Set.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private final MemoryFragmentRepository memoryFragmentRepository;
    private final MemoryAuditClient memoryAuditClient;
    private final SemanticChunkService semanticChunkService;
    private final MemoryProjectionOutboxService memoryProjectionOutboxService;

    public MemoryCommandService(
            MemoryFragmentRepository memoryFragmentRepository,
            MemoryAuditClient memoryAuditClient,
            SemanticChunkService semanticChunkService,
            MemoryProjectionOutboxService memoryProjectionOutboxService
    ) {
        this.memoryFragmentRepository = memoryFragmentRepository;
        this.memoryAuditClient = memoryAuditClient;
        this.semanticChunkService = semanticChunkService;
        this.memoryProjectionOutboxService = memoryProjectionOutboxService;
    }

    @Transactional
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
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeUserId = defaultIfBlank(userId, "user-demo");
        String normalizedContent = normalizeContentText(contentText);
        boolean searchableValue = searchable == null || searchable;

        List<SemanticChunkService.ChunkCandidate> chunks = semanticChunkService.chunkForCreate(
                normalizedContent,
                normalizeTimelineRoot(timelineRoot)
        );

        MemoryFragmentDO primaryFragment = null;
        for (SemanticChunkService.ChunkCandidate chunk : chunks) {
            MemoryFragmentDO memoryFragment = new MemoryFragmentDO();
            memoryFragment.setId(generateId());
            memoryFragment.setTenantId(safeTenantId);
            memoryFragment.setAppId(safeAppId);
            memoryFragment.setUserId(safeUserId);
            memoryFragment.setContentText(chunk.content());
            memoryFragment.setSearchable(searchableValue);
            memoryFragment.setDeleted(false);
            memoryFragment.setCreatedAt(now);
            applyChunkMetadata(memoryFragment, chunk);
            memoryFragmentRepository.save(memoryFragment);
            memoryProjectionOutboxService.enqueueUpsert(memoryFragment);
            publishAuditEvent(requestId, "MEMORY_CREATED", memoryFragment, Map.of(
                    "action", "create",
                    "timelineRoot", memoryFragment.getTimelineRoot(),
                    "searchable", memoryFragment.isSearchable(),
                    "chunkSeq", safeChunkSeq(memoryFragment),
                    "chunkStrategy", defaultIfBlank(memoryFragment.getChunkStrategy(), "LOCAL_FALLBACK"),
                    "fragmentType", defaultIfBlank(memoryFragment.getFragmentType(), "EVENT")
            ));
            if (primaryFragment == null) {
                primaryFragment = memoryFragment;
            }
        }
        return toView(primaryFragment);
    }

    @Transactional
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
        applyChunkMetadata(memoryFragment, semanticChunkService.buildSingleChunkMetadata(
                memoryFragment.getContentText(),
                memoryFragment.getTimelineRoot(),
                "MANUAL_UPDATE"
        ));
        memoryFragmentRepository.update(memoryFragment);
        memoryProjectionOutboxService.enqueueUpsert(memoryFragment);
        publishAuditEvent(requestId, "MEMORY_UPDATED", memoryFragment, Map.of(
                "action", "update",
                "timelineRoot", memoryFragment.getTimelineRoot(),
                "searchable", memoryFragment.isSearchable(),
                "chunkSeq", safeChunkSeq(memoryFragment),
                "chunkStrategy", defaultIfBlank(memoryFragment.getChunkStrategy(), "MANUAL_UPDATE"),
                "fragmentType", defaultIfBlank(memoryFragment.getFragmentType(), "EVENT")
        ));
        return toView(memoryFragment);
    }

    @Transactional
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
            memoryFragment.setDeleted(true);
            memoryFragment.setSearchable(false);
            memoryProjectionOutboxService.enqueueDelete(memoryFragment);
            publishAuditEvent(requestId, "MEMORY_DELETED", memoryFragment, Map.of(
                    "action", "delete",
                    "timelineRoot", memoryFragment.getTimelineRoot()
            ));
        }
        return new MemoryDeleteResultView(id, affected > 0);
    }

    @Transactional
    public MemoryBulkEraseResultView eraseUserFragments(String requestId, String tenantId, String appId, String userId) {
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeUserId = defaultIfBlank(userId, "user-demo");
        List<MemoryFragmentDO> activeFragments = memoryFragmentRepository.findActiveByUser(safeTenantId, safeAppId, safeUserId);
        int affectedCount = memoryFragmentRepository.softDeleteAllByUser(safeTenantId, safeAppId, safeUserId);
        for (MemoryFragmentDO fragment : activeFragments) {
            fragment.setDeleted(true);
            fragment.setSearchable(false);
            memoryProjectionOutboxService.enqueueDelete(fragment);
        }
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
                defaultIfBlank(memoryFragment.getFragmentType(), "EVENT"),
                defaultIfBlank(memoryFragment.getVisibility(), "PRIVATE"),
                defaultIfBlank(memoryFragment.getTimeBucket(), "today"),
                splitTags(memoryFragment.getTopicTags()),
                splitTags(memoryFragment.getEmotionTags()),
                safeChunkSeq(memoryFragment),
                safeChunkConfidence(memoryFragment),
                defaultIfBlank(memoryFragment.getChunkStrategy(), "LOCAL_FALLBACK"),
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

    private void applyChunkMetadata(MemoryFragmentDO memoryFragment, SemanticChunkService.ChunkCandidate chunk) {
        memoryFragment.setTimelineRoot(normalizeTimelineRoot(chunk.timelineRoot()));
        memoryFragment.setFragmentType(defaultIfBlank(chunk.fragmentType(), "EVENT"));
        memoryFragment.setVisibility(defaultIfBlank(chunk.visibility(), "PRIVATE"));
        memoryFragment.setTimeBucket(defaultIfBlank(chunk.timeBucket(), "today"));
        memoryFragment.setTopicTags(joinTags(chunk.topicTags()));
        memoryFragment.setEmotionTags(joinTags(chunk.emotionTags()));
        memoryFragment.setChunkSeq(chunk.seq());
        memoryFragment.setChunkConfidence(chunk.chunkConfidence());
        memoryFragment.setChunkStrategy(defaultIfBlank(chunk.chunkStrategy(), "LOCAL_FALLBACK"));
    }

    private String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }
        return tags.stream()
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(6)
                .collect(Collectors.joining("|"));
    }

    private List<String> splitTags(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split("\\|"))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(6)
                .toList();
    }

    private int safeChunkSeq(MemoryFragmentDO memoryFragment) {
        return memoryFragment.getChunkSeq() == null || memoryFragment.getChunkSeq() < 1
                ? 1
                : memoryFragment.getChunkSeq();
    }

    private double safeChunkConfidence(MemoryFragmentDO memoryFragment) {
        if (memoryFragment.getChunkConfidence() == null) {
            return 0.5d;
        }
        return Math.max(0.01d, Math.min(memoryFragment.getChunkConfidence(), 0.99d));
    }
}
