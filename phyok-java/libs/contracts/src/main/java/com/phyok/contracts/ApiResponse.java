package com.phyok.contracts;

public record ApiResponse<T>(
        String code,
        String message,
        String requestId,
        T data
) {
    public static <T> ApiResponse<T> ok(String requestId, T data) {
        return new ApiResponse<>("OK", "success", requestId, data);
    }

    public static <T> ApiResponse<T> fail(String requestId, String code, String message, T data) {
        return new ApiResponse<>(code, message, requestId, data);
    }
}
