package com.phyok.memory.infrastructure.mybatis.mapper;

import com.phyok.memory.infrastructure.mybatis.entity.MemoryProjectionOutboxDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;
import java.util.List;

@Mapper
public interface MemoryProjectionOutboxMapper {
    int insert(MemoryProjectionOutboxDO outboxEvent);

    List<MemoryProjectionOutboxDO> selectPendingForProcessing(@Param("limit") int limit);

    int markProcessing(
            @Param("id") String id,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    int markCompleted(
            @Param("id") String id,
            @Param("processedAt") OffsetDateTime processedAt
    );

    int markRetry(
            @Param("id") String id,
            @Param("availableAt") OffsetDateTime availableAt,
            @Param("lastError") String lastError,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    int markDead(
            @Param("id") String id,
            @Param("lastError") String lastError,
            @Param("updatedAt") OffsetDateTime updatedAt
    );
}
