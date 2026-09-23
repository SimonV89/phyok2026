package com.phyok.privacy.application.service;

import com.phyok.contracts.ComplaintTicketPageView;
import com.phyok.contracts.ComplaintTicketView;
import com.phyok.contracts.PrivacyDeleteJobPageView;
import com.phyok.contracts.PrivacyDeleteJobView;
import com.phyok.contracts.PrivacyEraseStatusView;
import com.phyok.privacy.infrastructure.client.PrivacyAuditClient;
import com.phyok.privacy.infrastructure.client.PrivacyAuthClient;
import com.phyok.privacy.infrastructure.client.PrivacyMemoryClient;
import com.phyok.privacy.infrastructure.client.PrivacyTenantClient;
import com.phyok.privacy.infrastructure.mybatis.entity.PrivacyDeleteJobDO;
import com.phyok.privacy.infrastructure.repository.PrivacyDeleteJobRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PrivacyDeleteJobService {
    private final PrivacyDeleteJobRepository privacyDeleteJobRepository;
    private final PrivacyMemoryClient privacyMemoryClient;
    private final PrivacyAuthClient privacyAuthClient;
    private final PrivacyTenantClient privacyTenantClient;
    private final PrivacyAuditClient privacyAuditClient;

    public PrivacyDeleteJobService(
            PrivacyDeleteJobRepository privacyDeleteJobRepository,
            PrivacyMemoryClient privacyMemoryClient,
            PrivacyAuthClient privacyAuthClient,
            PrivacyTenantClient privacyTenantClient,
            PrivacyAuditClient privacyAuditClient
    ) {
        this.privacyDeleteJobRepository = privacyDeleteJobRepository;
        this.privacyMemoryClient = privacyMemoryClient;
        this.privacyAuthClient = privacyAuthClient;
        this.privacyTenantClient = privacyTenantClient;
        this.privacyAuditClient = privacyAuditClient;
    }

    public PrivacyDeleteJobView createJob(
            String requestId,
            String tenantId,
            String appId,
            String userId,
            String scope,
            String requestedBy,
            String reason
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        PrivacyDeleteJobDO deleteJob = new PrivacyDeleteJobDO();
        deleteJob.setJobId(generateJobId());
        deleteJob.setTenantId(defaultIfBlank(tenantId, "tenant-demo"));
        deleteJob.setAppId(defaultIfBlank(appId, "app-self-explore"));
        deleteJob.setUserId(defaultIfBlank(userId, "user-demo"));
        deleteJob.setScope(defaultIfBlank(scope, "USER_FULL_ERASURE"));
        deleteJob.setStatus("RUNNING");
        deleteJob.setAffectedCount(0);
        deleteJob.setRequestedBy(defaultIfBlank(requestedBy, deleteJob.getUserId()));
        deleteJob.setReason(blankToNull(reason));
        deleteJob.setCreatedAt(now);
        privacyDeleteJobRepository.save(deleteJob);
        publishAuditEvent(requestId, "PRIVACY_DELETE_JOB_STARTED", deleteJob, Map.of(
                "action", "start",
                "scope", deleteJob.getScope()
        ));
        int memoryAffectedCount = 0;
        int revokedSessionCount = 0;
        boolean accountErased = false;
        int tenantAffectedCount = 0;
        boolean tenantErased = false;
        boolean appErased = false;
        try {
            memoryAffectedCount = privacyMemoryClient.eraseUserMemories(
                    defaultIfBlank(requestId, "req-privacy"),
                    deleteJob.getTenantId(),
                    deleteJob.getAppId(),
                    deleteJob.getUserId()
            );
            PrivacyAuthClient.EraseSummary authResult = privacyAuthClient.eraseUserAuthData(
                    defaultIfBlank(requestId, "req-privacy"),
                    deleteJob.getTenantId(),
                    deleteJob.getAppId(),
                    deleteJob.getUserId()
            );
            revokedSessionCount = authResult.revokedSessionCount();
            accountErased = authResult.accountErased();
            if (requiresTenantOrchestration(deleteJob.getScope())) {
                PrivacyTenantClient.EraseSummary tenantResult = privacyTenantClient.applyPrivacyErase(
                        defaultIfBlank(requestId, "req-privacy"),
                        deleteJob.getTenantId(),
                        deleteJob.getAppId(),
                        deleteJob.getScope()
                );
                tenantAffectedCount = tenantResult.affectedCount();
                tenantErased = tenantResult.tenantErased();
                appErased = tenantResult.appErased();
            }
            int affectedCount = memoryAffectedCount + revokedSessionCount + tenantAffectedCount + (accountErased ? 1 : 0);
            deleteJob.setAffectedCount(affectedCount);
            deleteJob.setStatus("COMPLETED");
            privacyDeleteJobRepository.updateExecutionResult(deleteJob.getJobId(), "COMPLETED", affectedCount);
            publishAuditEvent(requestId, "PRIVACY_DELETE_JOB_COMPLETED", deleteJob, Map.of(
                    "action", "complete",
                    "affectedCount", affectedCount,
                    "memoryAffectedCount", memoryAffectedCount,
                    "revokedSessionCount", revokedSessionCount,
                    "accountErased", accountErased,
                    "tenantAffectedCount", tenantAffectedCount,
                    "tenantErased", tenantErased,
                    "appErased", appErased
            ));
        } catch (Exception exception) {
            int partialAffectedCount = memoryAffectedCount + revokedSessionCount + tenantAffectedCount + (accountErased ? 1 : 0);
            deleteJob.setAffectedCount(partialAffectedCount);
            deleteJob.setStatus("FAILED");
            privacyDeleteJobRepository.updateExecutionResult(deleteJob.getJobId(), "FAILED", partialAffectedCount);
            publishAuditEvent(requestId, "PRIVACY_DELETE_JOB_FAILED", deleteJob, Map.of(
                    "action", "failed",
                    "affectedCount", partialAffectedCount,
                    "memoryAffectedCount", memoryAffectedCount,
                    "revokedSessionCount", revokedSessionCount,
                    "accountErased", accountErased,
                    "tenantAffectedCount", tenantAffectedCount,
                    "tenantErased", tenantErased,
                    "appErased", appErased
            ));
        }
        return toView(deleteJob);
    }

    public PrivacyDeleteJobPageView listJobs(
            String tenantId,
            String appId,
            String userId,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int offset = (safePageNo - 1) * safePageSize;
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeUserId = blankToNull(userId);
        String safeStatus = blankToNull(status);
        int total = privacyDeleteJobRepository.countJobs(safeTenantId, safeAppId, safeUserId, safeStatus);
        List<PrivacyDeleteJobView> items = privacyDeleteJobRepository.findJobsPage(
                        safeTenantId,
                        safeAppId,
                        safeUserId,
                        safeStatus,
                        safePageSize,
                        offset
                ).stream()
                .map(this::toView)
                .toList();
        return new PrivacyDeleteJobPageView(safePageNo, safePageSize, total, items);
    }

    public ComplaintTicketPageView listComplaintTickets(
            String tenantId,
            String appId,
            String userId,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int offset = (safePageNo - 1) * safePageSize;
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        String safeUserId = blankToNull(userId);
        String safeStatus = blankToNull(status);
        int total = privacyDeleteJobRepository.countJobs(safeTenantId, safeAppId, safeUserId, safeStatus);
        List<ComplaintTicketView> items = privacyDeleteJobRepository.findJobsPage(
                        safeTenantId,
                        safeAppId,
                        safeUserId,
                        safeStatus,
                        safePageSize,
                        offset
                ).stream()
                .map(this::toComplaintTicketView)
                .toList();
        return new ComplaintTicketPageView(safePageNo, safePageSize, total, items);
    }

    public PrivacyEraseStatusView eraseStatus(String tenantId, String appId) {
        String safeTenantId = defaultIfBlank(tenantId, "tenant-demo");
        String safeAppId = defaultIfBlank(appId, "app-self-explore");
        int runningJobs = privacyDeleteJobRepository.countJobs(safeTenantId, safeAppId, null, "RUNNING");
        int queuedJobs = privacyDeleteJobRepository.countJobs(safeTenantId, safeAppId, null, "QUEUED");
        String state = runningJobs > 0 ? "RUNNING" : (queuedJobs > 0 ? "PENDING" : "IDLE");
        return new PrivacyEraseStatusView(runningJobs, queuedJobs, state);
    }

    private PrivacyDeleteJobView toView(PrivacyDeleteJobDO deleteJob) {
        return new PrivacyDeleteJobView(
                deleteJob.getJobId(),
                deleteJob.getTenantId(),
                deleteJob.getAppId(),
                deleteJob.getUserId(),
                deleteJob.getScope(),
                deleteJob.getStatus(),
                deleteJob.getAffectedCount(),
                deleteJob.getRequestedBy(),
                deleteJob.getReason(),
                deleteJob.getCreatedAt()
        );
    }

    private ComplaintTicketView toComplaintTicketView(PrivacyDeleteJobDO deleteJob) {
        return new ComplaintTicketView(
                deleteJob.getJobId(),
                deleteJob.getTenantId(),
                deleteJob.getAppId(),
                deleteJob.getUserId(),
                toComplaintCategory(deleteJob.getScope()),
                deleteJob.getStatus(),
                defaultIfBlank(deleteJob.getRequestedBy(), deleteJob.getUserId()),
                buildComplaintSummary(deleteJob),
                deleteJob.getAffectedCount(),
                "privacy_delete_job",
                deleteJob.getCreatedAt()
        );
    }

    private String generateJobId() {
        return "erase_" + UUID.randomUUID().toString().replace("-", "");
    }

    private String defaultIfBlank(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean requiresTenantOrchestration(String scope) {
        return "APP_FULL_ERASURE".equalsIgnoreCase(scope) || "TENANT_FULL_ERASURE".equalsIgnoreCase(scope);
    }

    private String toComplaintCategory(String scope) {
        if (scope == null || scope.isBlank()) {
            return "privacy";
        }
        if ("TENANT_FULL_ERASURE".equalsIgnoreCase(scope)) {
            return "tenant";
        }
        if ("APP_FULL_ERASURE".equalsIgnoreCase(scope)) {
            return "application";
        }
        return "privacy";
    }

    private String buildComplaintSummary(PrivacyDeleteJobDO deleteJob) {
        if (deleteJob.getReason() != null && !deleteJob.getReason().isBlank()) {
            return deleteJob.getReason().trim();
        }
        return "隐私删除请求：" + defaultIfBlank(deleteJob.getScope(), "USER_FULL_ERASURE");
    }

    private void publishAuditEvent(
            String requestId,
            String eventType,
            PrivacyDeleteJobDO deleteJob,
            Map<String, Object> extraPayload
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", deleteJob.getTenantId());
        payload.put("appId", deleteJob.getAppId());
        payload.put("userId", deleteJob.getUserId());
        payload.put("eventType", eventType);
        payload.put("sourceService", "privacy-service");
        payload.put("entityType", "PRIVACY_DELETE_JOB");
        payload.put("entityId", deleteJob.getJobId());
        payload.put("scope", deleteJob.getScope());
        payload.put("status", deleteJob.getStatus());
        payload.put("requestedBy", deleteJob.getRequestedBy());
        payload.putAll(extraPayload);
        String safeRequestId = defaultIfBlank(requestId, "req-privacy");
        privacyAuditClient.publishEvent(safeRequestId, safeRequestId + ":" + deleteJob.getJobId(), payload);
    }
}
