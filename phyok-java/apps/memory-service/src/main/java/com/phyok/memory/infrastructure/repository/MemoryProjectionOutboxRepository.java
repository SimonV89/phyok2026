package com.phyok.memory.infrastructure.repository;

import com.phyok.memory.infrastructure.mybatis.entity.MemoryProjectionOutboxDO;
import com.phyok.memory.infrastructure.mybatis.mapper.MemoryProjectionOutboxMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class MemoryProjectionOutboxRepository {
    private final MemoryProjectionOutboxMapper memoryProjectionOutboxMapper;

    public MemoryProjectionOutboxRepository(MemoryProjectionOutboxMapper memoryProjectionOutboxMapper) {
        this.memoryProjectionOutboxMapper = memoryProjectionOutboxMapper;
    }

    public int save(MemoryProjectionOutboxDO outboxEvent) {
        return memoryProjectionOutboxMapper.insert(outboxEvent);
    }

    public List<MemoryProjectionOutboxDO> findPendingForProcessing(int limit) {
        return memoryProjectionOutboxMapper.selectPendingForProcessing(limit);
    }

    public int markProcessing(String id, OffsetDateTime updatedAt) {
        return memoryProjectionOutboxMapper.markProcessing(id, updatedAt);
    }

    public int markCompleted(String id, OffsetDateTime processedAt) {
        return memoryProjectionOutboxMapper.markCompleted(id, processedAt);
    }

    public int markRetry(String id, OffsetDateTime availableAt, String lastError, OffsetDateTime updatedAt) {
        return memoryProjectionOutboxMapper.markRetry(id, availableAt, lastError, updatedAt);
    }

    public int markDead(String id, String lastError, OffsetDateTime updatedAt) {
        return memoryProjectionOutboxMapper.markDead(id, lastError, updatedAt);
    }
}
