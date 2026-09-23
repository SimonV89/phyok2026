package com.phyok.memory.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.contracts.MemoryProjectionEvent;
import com.phyok.kafka.TopicNames;
import com.phyok.memory.application.config.MemoryProperties;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryProjectionOutboxDO;
import com.phyok.memory.infrastructure.repository.MemoryProjectionOutboxRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class MemoryProjectionOutboxService {
    private static final int MAX_ATTEMPTS = 8;

    private final MemoryProjectionOutboxRepository memoryProjectionOutboxRepository;
    private final MemoryProperties memoryProperties;
    private final ObjectMapper objectMapper;

    public MemoryProjectionOutboxService(
            MemoryProjectionOutboxRepository memoryProjectionOutboxRepository,
            MemoryProperties memoryProperties,
            ObjectMapper objectMapper
    ) {
        this.memoryProjectionOutboxRepository = memoryProjectionOutboxRepository;
        this.memoryProperties = memoryProperties;
        this.objectMapper = objectMapper;
    }

    public void enqueueUpsert(MemoryFragmentDO fragment) {
        enqueue(fragment, "UPSERT", TopicNames.MEMORY_FRAGMENT_CREATED, buildPayload(fragment, "UPSERT"));
    }

    public void enqueueDelete(MemoryFragmentDO fragment) {
        enqueue(fragment, "DELETE", TopicNames.MEMORY_EMBEDDING_REQUESTED, buildPayload(fragment, "DELETE"));
    }

    @Transactional
    public List<MemoryProjectionOutboxDO> claimPendingEvents() {
        List<MemoryProjectionOutboxDO> items = memoryProjectionOutboxRepository.findPendingForProcessing(
                Math.max(memoryProperties.getOutboxWorkerBatchSize(), 1)
        );
        OffsetDateTime now = OffsetDateTime.now();
        return items.stream()
                .filter(item -> memoryProjectionOutboxRepository.markProcessing(item.getId(), now) > 0)
                .toList();
    }

    public void markCompleted(String id) {
        memoryProjectionOutboxRepository.markCompleted(id, OffsetDateTime.now());
    }

    public void markFailure(String id, int attemptCount, Exception exception) {
        String message = exception == null ? "unknown error" : safeTrim(exception.getMessage(), 1000);
        OffsetDateTime now = OffsetDateTime.now();
        if (attemptCount >= MAX_ATTEMPTS) {
            memoryProjectionOutboxRepository.markDead(id, message, now);
            return;
        }
        OffsetDateTime nextAvailableAt = now.plusSeconds(Math.min(60L * attemptCount, 300L));
        memoryProjectionOutboxRepository.markRetry(id, nextAvailableAt, message, now);
    }

    private void enqueue(MemoryFragmentDO fragment, String eventType, String topicName, MemoryProjectionEvent payload) {
        if (!memoryProperties.isOutboxEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        MemoryProjectionOutboxDO event = new MemoryProjectionOutboxDO();
        event.setId("mout_" + UUID.randomUUID().toString().replace("-", ""));
        event.setTenantId(fragment.getTenantId());
        event.setAppId(fragment.getAppId());
        event.setUserId(fragment.getUserId());
        event.setFragmentId(fragment.getId());
        event.setEventType(eventType);
        event.setTopicName(topicName);
        event.setPayloadJson(writeJson(payload));
        event.setStatus("PENDING");
        event.setAttemptCount(0);
        event.setAvailableAt(now);
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        memoryProjectionOutboxRepository.save(event);
    }

    private MemoryProjectionEvent buildPayload(MemoryFragmentDO fragment, String eventType) {
        return new MemoryProjectionEvent(
                eventType,
                fragment.getTenantId(),
                fragment.getAppId(),
                fragment.getUserId(),
                fragment.getId(),
                fragment.getTimelineRoot(),
                fragment.getFragmentType(),
                fragment.getVisibility(),
                fragment.getTimeBucket(),
                splitTags(fragment.getTopicTags()),
                splitTags(fragment.getEmotionTags()),
                fragment.isSearchable(),
                fragment.isDeleted(),
                fragment.getContentText(),
                fragment.getChunkSeq(),
                fragment.getChunkConfidence(),
                fragment.getChunkStrategy(),
                fragment.getCreatedAt() == null ? null : fragment.getCreatedAt().toEpochSecond()
        );
    }

    private String writeJson(MemoryProjectionEvent payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize memory outbox payload.", exception);
        }
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

    private String safeTrim(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "unknown error";
        }
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
