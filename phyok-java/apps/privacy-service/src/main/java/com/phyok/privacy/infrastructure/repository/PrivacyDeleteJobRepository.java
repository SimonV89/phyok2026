package com.phyok.privacy.infrastructure.repository;

import com.phyok.privacy.infrastructure.mybatis.entity.PrivacyDeleteJobDO;
import com.phyok.privacy.infrastructure.mybatis.mapper.PrivacyDeleteJobMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class PrivacyDeleteJobRepository {
    private final PrivacyDeleteJobMapper privacyDeleteJobMapper;

    public PrivacyDeleteJobRepository(PrivacyDeleteJobMapper privacyDeleteJobMapper) {
        this.privacyDeleteJobMapper = privacyDeleteJobMapper;
    }

    public int save(PrivacyDeleteJobDO deleteJob) {
        return privacyDeleteJobMapper.insert(deleteJob);
    }

    public int updateExecutionResult(String jobId, String status, int affectedCount) {
        return privacyDeleteJobMapper.updateExecutionResult(jobId, status, affectedCount);
    }

    public int countJobs(String tenantId, String appId, String userId, String status) {
        return privacyDeleteJobMapper.countJobs(tenantId, appId, userId, status);
    }

    public List<PrivacyDeleteJobDO> findJobsPage(
            String tenantId,
            String appId,
            String userId,
            String status,
            int limit,
            int offset
    ) {
        return privacyDeleteJobMapper.selectJobsPage(tenantId, appId, userId, status, limit, offset);
    }
}
