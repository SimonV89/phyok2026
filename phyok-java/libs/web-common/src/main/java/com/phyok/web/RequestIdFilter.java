package com.phyok.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {
    public static final String HEADER_NAME = "X-Request-Id";
    public static final String ATTRIBUTE_NAME = "requestId";
    public static final String TRACE_HEADER_NAME = "X-Trace-Id";
    public static final String TRACE_ATTRIBUTE_NAME = "traceId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = request.getHeader(HEADER_NAME);
        if (requestId == null || requestId.isBlank()) {
            requestId = "req_" + UUID.randomUUID();
        }
        String traceId = request.getHeader(TRACE_HEADER_NAME);
        if (traceId == null || traceId.isBlank()) {
            traceId = requestId;
        }
        request.setAttribute(ATTRIBUTE_NAME, requestId);
        request.setAttribute(TRACE_ATTRIBUTE_NAME, traceId);
        response.setHeader(HEADER_NAME, requestId);
        response.setHeader(TRACE_HEADER_NAME, traceId);
        filterChain.doFilter(request, response);
    }
}
