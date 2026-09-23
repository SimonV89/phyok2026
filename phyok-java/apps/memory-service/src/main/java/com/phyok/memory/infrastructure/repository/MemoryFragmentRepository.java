package com.phyok.memory.infrastructure.repository;

import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.mybatis.mapper.MemoryFragmentMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class MemoryFragmentRepository {
    private final MemoryFragmentMapper memoryFragmentMapper;

    public MemoryFragmentRepository(MemoryFragmentMapper memoryFragmentMapper) {
        this.memoryFragmentMapper = memoryFragmentMapper;
    }

    public int save(MemoryFragmentDO memoryFragment) {
        return memoryFragmentMapper.insert(memoryFragment);
    }

    public Optional<MemoryFragmentDO> findById(String tenantId, String appId, String userId, String id) {
        return Optional.ofNullable(memoryFragmentMapper.selectById(tenantId, appId, userId, id));
    }

    public Optional<MemoryFragmentDO> findByIdIncludingDeleted(String tenantId, String appId, String userId, String id) {
        return Optional.ofNullable(memoryFragmentMapper.selectByIdIncludingDeleted(tenantId, appId, userId, id));
    }

    public int update(MemoryFragmentDO memoryFragment) {
        return memoryFragmentMapper.updateById(memoryFragment);
    }

    public int softDelete(String tenantId, String appId, String userId, String id) {
        return memoryFragmentMapper.softDeleteById(tenantId, appId, userId, id);
    }

    public int softDeleteAllByUser(String tenantId, String appId, String userId) {
        return memoryFragmentMapper.softDeleteByUser(tenantId, appId, userId);
    }

    public int countSearchableFragments(String tenantId, String appId, String userId) {
        return memoryFragmentMapper.countSearchableFragments(tenantId, appId, userId);
    }

    public int countFragments(String tenantId, String appId, String userId, String timelineRoot) {
        return memoryFragmentMapper.countFragments(tenantId, appId, userId, timelineRoot);
    }

    public List<MemoryFragmentDO> findLatestSearchableFragments(String tenantId, String appId, String userId, int limit) {
        return memoryFragmentMapper.selectLatestSearchableFragments(tenantId, appId, userId, limit);
    }

    public List<MemoryFragmentDO> findFragmentsPage(
            String tenantId,
            String appId,
            String userId,
            String timelineRoot,
            int limit,
            int offset
    ) {
        return memoryFragmentMapper.selectFragmentsPage(tenantId, appId, userId, timelineRoot, limit, offset);
    }

    public List<MemoryFragmentDO> findByIds(String tenantId, String appId, String userId, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return memoryFragmentMapper.selectByIds(tenantId, appId, userId, ids);
    }

    public List<MemoryFragmentDO> findActiveByUser(String tenantId, String appId, String userId) {
        return memoryFragmentMapper.selectActiveByUser(tenantId, appId, userId);
    }
}
