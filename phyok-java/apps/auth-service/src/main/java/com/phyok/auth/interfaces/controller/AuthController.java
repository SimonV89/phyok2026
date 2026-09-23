package com.phyok.auth.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.AdminUserPageView;
import com.phyok.contracts.AdminUserView;
import com.phyok.contracts.AuthEraseResultView;
import com.phyok.contracts.AuthPrincipalView;
import com.phyok.auth.application.service.AuthAdminQueryService;
import com.phyok.auth.application.service.AuthCommandService;
import com.phyok.auth.application.service.AuthQueryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class AuthController {
    private final AuthQueryService authQueryService;
    private final AuthAdminQueryService authAdminQueryService;
    private final AuthCommandService authCommandService;

    public AuthController(
            AuthQueryService authQueryService,
            AuthAdminQueryService authAdminQueryService,
            AuthCommandService authCommandService
    ) {
        this.authQueryService = authQueryService;
        this.authAdminQueryService = authAdminQueryService;
        this.authCommandService = authCommandService;
    }

    @PostMapping("/internal/auth/verify-token")
    public ApiResponse<AuthPrincipalView> verifyToken(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        if (authorization == null || authorization.isBlank()) {
            return ApiResponse.fail(
                    requestIdOrDefault(requestId),
                    "AUTH_UNAUTHORIZED",
                    "缺少会话令牌。",
                    (AuthPrincipalView) null
            );
        }
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                authQueryService.verifyToken(extractSessionToken(authorization))
        );
    }

    @PostMapping("/v2/auth/email/send-code")
    public ApiResponse<Map<String, Object>> sendCode(
            @Valid @RequestBody SendCodeRequest body,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-App-Id", required = false) String appId
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                authCommandService.sendEmailCode(requestIdOrDefault(requestId), body.email(), body.locale(), appId)
        );
    }

    @PostMapping("/v2/auth/email/verify")
    public ApiResponse<Map<String, Object>> verifyCode(
            @Valid @RequestBody VerifyCodeRequest body,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-App-Id", required = false) String appId,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceId,
            @RequestHeader(value = "X-Client-Version", required = false) String clientVersion
    ) {
        try {
            return ApiResponse.ok(
                    requestIdOrDefault(requestId),
                    authCommandService.verifyEmailCode(
                            requestIdOrDefault(requestId),
                            body.email(),
                            body.code(),
                            appId,
                            deviceId,
                            clientVersion
                    )
            );
        } catch (IllegalArgumentException exception) {
            return ApiResponse.fail(
                    requestIdOrDefault(requestId),
                    "AUTH_INVALID_EMAIL_CODE",
                    exception.getMessage(),
                    Map.of("verified", false)
            );
        }
    }

    @GetMapping("/internal/auth/admin/users")
    public ApiResponse<AdminUserPageView> listUsers(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestParam(value = "tenantId", required = false) String tenantId,
            @RequestParam(value = "appId", required = false) String appId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "pageNo", defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", defaultValue = "20") Integer pageSize,
            @RequestParam(value = "includeDeleted", defaultValue = "false") boolean includeDeleted
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                authAdminQueryService.listUsers(tenantId, appId, keyword, status, pageNo, pageSize, includeDeleted)
        );
    }

    @GetMapping("/internal/auth/admin/users/{userId}")
    public ApiResponse<AdminUserView> userDetail(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @PathVariable("userId") String userId,
            @RequestParam(value = "tenantId", required = false) String tenantId,
            @RequestParam(value = "appId", required = false) String appId
    ) {
        AdminUserView view = authAdminQueryService.getUserDetail(tenantId, appId, userId);
        if (view == null) {
            return ApiResponse.fail(requestIdOrDefault(requestId), "AUTH_USER_NOT_FOUND", "用户不存在。", null);
        }
        return ApiResponse.ok(requestIdOrDefault(requestId), view);
    }

    @PostMapping("/internal/auth/erase-user")
    public ApiResponse<AuthEraseResultView> eraseUser(
            @RequestBody EraseUserRequest body,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId
    ) {
        return ApiResponse.ok(
                requestIdOrDefault(requestId),
                authCommandService.eraseUserAuthData(
                        requestIdOrDefault(requestId),
                        body.tenantId(),
                        body.appId(),
                        body.userId()
                )
        );
    }

    @GetMapping("/internal/health")
    public ApiResponse<Map<String, Object>> health(@RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        return ApiResponse.ok(requestIdOrDefault(requestId), Map.of("service", "auth-service", "status", "UP"));
    }

    private String requestIdOrDefault(String requestId) {
        return requestId == null || requestId.isBlank() ? "req-auth" : requestId;
    }

    private String extractSessionToken(String authorization) {
        String prefix = "Bearer ";
        return authorization.startsWith(prefix) ? authorization.substring(prefix.length()).trim() : authorization.trim();
    }

    public record SendCodeRequest(
            @NotBlank @Email String email,
            String locale
    ) {
    }

    public record VerifyCodeRequest(
            @NotBlank @Email String email,
            @NotBlank String code
    ) {
    }

    public record EraseUserRequest(
            String tenantId,
            String appId,
            String userId
    ) {
    }
}
