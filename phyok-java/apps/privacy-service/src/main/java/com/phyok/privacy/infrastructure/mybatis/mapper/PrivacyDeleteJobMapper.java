package com.phyok.privacy.infrastructure.mybatis.mapper;

import com.phyok.privacy.infrastructure.mybatis.entity.PrivacyDeleteJobDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PrivacyDeleteJobMapper {
    int insert(PrivacyDeleteJobDO deleteJob);

    int updateExecutionResult(
            @Param("jobId") String jobId,
            @Param("status") String status,
            @Param("affectedCount") int affectedCount
    );

    int countJobs(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("status") String status
    );

    List<PrivacyDeleteJobDO> selectJobsPage(
            @Param("tenantId") String tenantId,
            @Param("appId") String appId,
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("limit") int limit,
            @Param("offset") int offset
    );
}
