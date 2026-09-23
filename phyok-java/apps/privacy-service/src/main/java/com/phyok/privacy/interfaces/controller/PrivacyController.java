package com.phyok.privacy.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.ComplaintTicketPageView;
import com.phyok.contracts.PrivacyDeleteJobPageView;
import com.phyok.contracts.PrivacyDeleteJobView;
import com.phyok.contracts.PrivacyEraseStatusView;
import com.phyok.privacy.application.service.PrivacyDeleteJobService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class PrivacyController {
    private final PrivacyDeleteJobService privacyDeleteJobService;

    public PrivacyController(PrivacyDeleteJobService privacyDeleteJobService) {
        this.privacyDeleteJobService = privacyDeleteJobService;
    }

    @GetMapping("/v2/privacy/delete-jobs/preview")
    public ApiResponse<PrivacyDeleteJobView> deleteJobsPreview(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", defaultValue = "user-demo") String userId
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                new PrivacyDeleteJobView(
                        "preview",
                        tenantId,
                        appId,
                        userId,
                        "USER_FULL_ERASURE",
                        "PREVIEW",
                        0,
                        userId,
                        "用户预览隐私删除任务",
                        null
                )
        );
    }

    @PostMapping("/v2/privacy/delete-jobs")
    public ApiResponse<PrivacyDeleteJobView> createDeleteJob(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @Valid @RequestBody CreatePrivacyDeleteJobRequest request
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                privacyDeleteJobService.createJob(
                        requestIdOrDefault(requestId),
                        request.tenantId(),
                        request.appId(),
                        request.userId(),
                        request.scope(),
                        request.requestedBy(),
                        request.reason()
                )
        );
    }

    @GetMapping("/v2/privacy/delete-jobs")
    public ApiResponse<PrivacyDeleteJobPageView> listDeleteJobs(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") Integer pageSize
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                privacyDeleteJobService.listJobs(tenantId, appId, userId, status, pageNo, pageSize)
        );
    }

    @GetMapping("/internal/privacy/admin/complaints")
    public ApiResponse<ComplaintTicketPageView> listComplaintTickets(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") Integer pageSize
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                privacyDeleteJobService.listComplaintTickets(tenantId, appId, userId, status, pageNo, pageSize)
        );
    }

    @GetMapping("/internal/privacy/erase-status")
    public ApiResponse<PrivacyEraseStatusView> eraseStatus(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", defaultValue = "tenant-demo") String tenantId,
            @RequestParam(value = "appId", defaultValue = "app-self-explore") String appId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), privacyDeleteJobService.eraseStatus(tenantId, appId));
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "privacy-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-privacy" : requestId;
    }
}
