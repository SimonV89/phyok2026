package com.phyok.memory.infrastructure.mybatis.mapper;

import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MemoryFragmentMapper {
    int insert(MemoryFragmentDO memoryFragment);

    MemoryFragmentDO selectById(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("id") String id
    );

    MemoryFragmentDO selectByIdIncludingDeleted(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("id") String id
    );

    int updateById(MemoryFragmentDO memoryFragment);

    int softDeleteById(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("id") String id
    );

    int softDeleteByUser(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );

    int countSearchableFragments(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );

    int countFragments(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("timelineRoot") String timelineRoot
    );

    List<MemoryFragmentDO> selectLatestSearchableFragments(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("limit") int limit
    );

    List<MemoryFragmentDO> selectFragmentsPage(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("timelineRoot") String timelineRoot,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    List<MemoryFragmentDO> selectByIds(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("ids") List<String> ids
    );

    List<MemoryFragmentDO> selectActiveByUser(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId
    );
}
