package com.phyok.auth.interfaces.controller;

import com.phyok.contracts.ApiResponse;
import com.phyok.contracts.AuthEraseResultView;
import com.phyok.contracts.AuthPrincipalView;
import com.phyok.auth.application.service.AuthCommandService;
import com.phyok.auth.application.service.AuthQueryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class AuthController {
    private final AuthQueryService authQueryService;
    private final AuthCommandService authCommandService;

    public AuthController(AuthQueryService authQueryService, AuthCommandService authCommandService) {
        this.authQueryService = authQueryService;
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
